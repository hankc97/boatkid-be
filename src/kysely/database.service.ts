import { Injectable, Logger } from "@nestjs/common";
import { withDB, withTrx } from "./db";
import { GameState } from "../module/user/game-timer.service";
import { GameResolutionResult } from "../module/admin/admin.service";

export interface GameStorageData {
  gameState: GameState;
  resolutionResult: GameResolutionResult;
  participants: any[]; // Full participant data from blockchain
  autoResolved: boolean;
  timerStartedAt?: number;
  timerEndsAt?: number;
  timerDuration?: number;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  /**
   * Check if a game has already been stored in the database
   */
  async isGameAlreadyStored(gameAddress: string): Promise<boolean> {
    try {
      return withDB(async (db) => {
        const existingGame = await db
          .selectFrom("boatkid_historical_games")
          .select("game_address")
          .where("game_address", "=", gameAddress)
          .executeTakeFirst();

        return !!existingGame;
      });
    } catch (error) {
      this.logger.error(
        `Error checking if game ${gameAddress} is already stored:`,
        error
      );
      return false; // Assume not stored if check fails
    }
  }

  /**
   * Store a resolved game and its participants in PostgreSQL
   */
  async storeHistoricalGame(data: GameStorageData): Promise<void> {
    try {
      // Check if game is already stored to prevent duplicates
      const alreadyStored = await this.isGameAlreadyStored(
        data.gameState.gameAddress
      );
      if (alreadyStored) {
        this.logger.log(
          `🔄 Game ${data.gameState.gameAddress} already stored in database, skipping duplicate storage`
        );
        return;
      }

      await withTrx(async (trx) => {
        // Calculate participant statistics
        const totalPrizePoolRaw = data.participants.reduce(
          (sum, p) => sum + p.account.amount.toNumber(),
          0
        );

        // Store historical game
        const historicalGame = await trx
          .insertInto("boatkid_historical_games")
          .values({
            // Game identification
            game_address: data.gameState.gameAddress,
            game_id: data.gameState.gameId,
            nonce: data.gameState.nonce!,

            // Game configuration
            max_participants: data.gameState.maxParticipants,
            max_bet_size: data.gameState.maxBetSize.toString(),

            // Game lifecycle
            status: data.gameState.status,
            on_chain_status: data.gameState.onChainStatus!,
            created_at_timestamp: data.gameState.createdAt,

            // Game outcome
            winner_address: data.resolutionResult.winner,
            transaction_signature: data.resolutionResult.transactionSignature,
            total_participants: data.resolutionResult.participants,
            total_prize_pool: data.resolutionResult.totalPrizePool.toString(),
            total_prize_pool_raw: totalPrizePoolRaw,

            // Timer information
            timer_started_at: data.timerStartedAt || null,
            timer_ends_at: data.timerEndsAt || null,
            timer_duration: data.timerDuration || null,
            auto_resolved: data.autoResolved,

            // Additional metadata
            participants_data: JSON.stringify(data.participants),
            game_state_snapshot: JSON.stringify(data.gameState),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Store historical players
        const playersToInsert = data.participants.map((participant, index) => {
          const betAmount = participant.account.amount.toNumber();
          const betAmountInTokens = betAmount / Math.pow(10, 6); // Convert to readable format
          const betPercentage = (betAmount / totalPrizePoolRaw) * 100;
          const winProbability = betPercentage; // Simple probability based on bet size
          const isWinner =
            participant.account.user.toString() ===
            data.resolutionResult.winner;

          return {
            // Player identification
            player_address: participant.account.user.toString(),
            game_address: data.gameState.gameAddress,
            game_id: data.gameState.gameId,

            // Bet information
            bet_amount: betAmountInTokens.toString(),
            bet_amount_raw: betAmount,
            token_mint:
              participant.account.token?.toString() ||
              data.participants[0]?.account?.token?.toString() ||
              "unknown",
            bet_pda: participant.publicKey.toString(),

            // Game participation
            joined_at: data.gameState.createdAt, // Use game creation time as fallback
            player_position: index + 1,
            is_winner: isWinner,

            // Probability and odds
            win_probability: winProbability.toString(),
            bet_percentage: betPercentage.toString(),

            // Additional data
            player_data: JSON.stringify({
              originalParticipantData: participant,
              betAmountInTokens,
              winProbability,
            }),
          };
        });

        if (playersToInsert.length > 0) {
          await trx
            .insertInto("boatkid_historical_players")
            .values(playersToInsert)
            .execute();
        }

        this.logger.log(
          `✅ Successfully stored historical game ${data.gameState.gameAddress} with ${playersToInsert.length} players`
        );
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to store historical game ${data.gameState.gameAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get historical games with pagination
   */
  async getHistoricalGames(
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return withDB(async (db) => {
      return await db
        .selectFrom("boatkid_historical_games")
        .selectAll()
        .orderBy("resolved_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();
    });
  }

  /**
   * Get historical games for a specific player
   */
  async getPlayerHistory(
    playerAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return withDB(async (db) => {
      return await db
        .selectFrom("boatkid_historical_players")
        .innerJoin(
          "boatkid_historical_games",
          "boatkid_historical_players.game_address",
          "boatkid_historical_games.game_address"
        )
        .selectAll("boatkid_historical_games")
        .select([
          "boatkid_historical_players.bet_amount",
          "boatkid_historical_players.is_winner",
          "boatkid_historical_players.win_probability",
          "boatkid_historical_players.player_position",
        ])
        .where("boatkid_historical_players.player_address", "=", playerAddress)
        .orderBy("boatkid_historical_games.resolved_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();
    });
  }

  /**
   * Get game statistics
   */
  async getGameStatistics(): Promise<{
    totalGames: number;
    totalPlayers: number;
    totalVolume: string;
    averageGameSize: string;
  }> {
    return withDB(async (db) => {
      const [stats, volumeStats] = await Promise.all([
        db
          .selectFrom("boatkid_historical_games")
          .select([
            (eb) => eb.fn.count("id").as("total_games"),
            (eb) => eb.fn.sum("total_participants").as("total_players"),
            (eb) => eb.fn.avg("total_participants").as("average_game_size"),
          ])
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("boatkid_historical_games")
          .select((eb) => eb.fn.sum("total_prize_pool").as("total_volume"))
          .executeTakeFirstOrThrow(),
      ]);

      return {
        totalGames: Number(stats.total_games),
        totalPlayers: Number(stats.total_players),
        totalVolume: volumeStats.total_volume?.toString() || "0",
        averageGameSize: Number(stats.average_game_size).toFixed(2),
      };
    });
  }
}
