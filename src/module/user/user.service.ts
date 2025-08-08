import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN, Wallet } from "@coral-xyz/anchor";
import base58 from "bs58";
import { getProgram, PROGRAM_ID } from "../../program/program";
import { RedisService } from "../redis/redis.service";
import { PusherService } from "../pusher/pusher.service";
import { GameTimerService } from "./game-timer.service";
import {
  CURRENT_GAME_KEY,
  GAME_STATE_KEY,
  GAME_PLAYERS_KEY,
} from "../redis/redis.keys";

export const MINT = "7fCZBjhEeB6nSktQa9381k5XHJ7SJ4bHnLfB3wgvjsYT";

// Helper function to prepare transaction (similar to stake.ts)
const prepareTransaction = async ({
  payer,
  instructions,
}: {
  payer: PublicKey;
  instructions: TransactionInstruction[];
}) => {
  const connection = new Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;
  transaction.add(...instructions);

  return { transaction };
};

// Helper function to get simulation units for transaction optimization
const getSimulationUnits = async (
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: PublicKey
): Promise<number | undefined> => {
  const testInstructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...instructions,
  ];

  const testVersionedTxn = new VersionedTransaction(
    new TransactionMessage({
      instructions: testInstructions,
      payerKey: payer,
      recentBlockhash: PublicKey.default.toString(),
    }).compileToV0Message()
  );

  try {
    const simulation = await connection.simulateTransaction(testVersionedTxn, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });

    if (simulation.value.err) {
      // Note: Using console.log here since this is a static helper function outside of class context
      console.log("Simulation failed during compute unit estimation:", {
        error: simulation.value.err,
        logs: simulation.value.logs,
        unitsConsumed: simulation.value.unitsConsumed,
      });

      // If it's just insufficient funds for rent, we can still use a reasonable estimate
      if (
        typeof simulation.value.err === "object" &&
        simulation.value.err !== null &&
        "InsufficientFundsForRent" in simulation.value.err
      ) {
        console.log(
          "Using estimated units despite InsufficientFundsForRent error"
        );
        return 200_000; // Reasonable estimate for game transactions
      }

      return undefined;
    }

    return simulation.value.unitsConsumed;
  } catch (error) {
    console.log("Error during simulation:", error);
    return undefined;
  }
};

export interface JoinGameRequest {
  wallet: string; // Player's wallet address
  betAmount?: number; // In tokens (default: 5)
}

export interface JoinGameResponse {
  success: boolean;
  message: string;
  txn?: string; // Base58 encoded transaction for frontend to sign
  gameAddress?: string;
  gameStatus?: any;
}

export interface ConfirmTransactionRequest {
  transactionId: string;
  wallet: string;
  betAmount?: number;
  gameAddress?: string;
}

export interface ConfirmTransactionResponse {
  confirmed: boolean;
  message?: string;
}

export interface GamePlayer {
  wallet: string;
  betAmount: number;
  joinedAt: number; // timestamp
  transactionId?: string;
  tokenMint: string; // Token mint address
  betPda?: string; // Game bet PDA address
}

export interface OnChainGameData {
  publicKey: string; // Game PDA address
  nonce: number;
  totalBetAmount: number;
  createdAt: number;
  maxAllowedParticipants: number;
  status: "initialized" | "started" | "resolved";
  joinedParticipants: number;
  maxBetSize: number;
  participants: GamePlayer[];
}

export interface GameState {
  gameId: string;
  gameAddress: string;
  status: "waiting" | "active" | "finished";
  maxParticipants: number;
  currentParticipants: number;
  players: GamePlayer[];
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  maxBetSize: number;
  totalPot: number;
  // On-chain specific data
  nonce?: number;
  onChainStatus?: "initialized" | "started" | "resolved";
  lastSyncedAt?: number; // When data was last synced from blockchain
  // Timer data
  timerStartedAt?: number; // When the auto-resolution timer started
  timerEndsAt?: number; // When the timer will expire and game will auto-resolve
  timerDuration?: number; // Duration in milliseconds (default: 60000ms = 1 minute)
}

@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);
  private readonly maxBetSize: number;
  private readonly maxParticipants: number;
  private readonly redisTtl: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly pusherService: PusherService,
    private readonly gameTimerService: GameTimerService
  ) {
    this.maxBetSize = 10 * Math.pow(10, 6); // 10 tokens max bet
    this.maxParticipants = 15; // 15 players max
    this.redisTtl = 60 * 60 * 24; // 24 hours TTL
  }

  // Initialize service and restore timers
  async onApplicationBootstrap(): Promise<void> {
    try {
      this.logger.log("UserService initialized, restoring game timers...");
      await this.restoreGameTimers();
    } catch (error) {
      this.logger.error("Error during UserService initialization:", error);
    }
  }

  async joinGameWithStartGame(
    request: JoinGameRequest
  ): Promise<JoinGameResponse> {
    try {
      this.logger.log("Building join game transaction");

      if (!request.wallet) {
        throw new Error("Wallet address is required");
      }

      // Get operator keypair from environment variable
      if (!process.env.OPERATOR_SK) {
        throw new Error("OPERATOR_SK environment variable is required");
      }
      const operatorKeypair = Keypair.fromSecretKey(
        new Uint8Array(base58.decode(process.env.OPERATOR_SK))
      );

      // Setup connection
      const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );

      // Create a readonly wallet for program setup
      const readonlyWallet = new Wallet(Keypair.generate());
      const program = await getProgram(readonlyWallet, PROGRAM_ID, connection);

      const playerPubkey = new PublicKey(request.wallet);
      const MINT_PUBKEY = new PublicKey(MINT);
      const betAmount = (request.betAmount || 5) * Math.pow(10, 6); // 5 tokens default
      const usdAmount = request.betAmount || 5; // USD amount equals bet amount

      this.logger.log(`Player: ${playerPubkey.toString()}`);
      this.logger.log(`Operator: ${operatorKeypair.publicKey.toString()}`);
      this.logger.log(`Token Mint: ${MINT_PUBKEY.toString()}`);
      this.logger.log(`Bet Amount: ${betAmount / Math.pow(10, 6)} tokens`);
      this.logger.log(`USD Amount: $${usdAmount}`);

      // Get player's token account
      const userAta = getAssociatedTokenAddressSync(MINT_PUBKEY, playerPubkey);
      this.logger.log(`Player Token Account: ${userAta.toString()}`);

      // Check user's token balance
      try {
        const tokenBalance = await connection.getTokenAccountBalance(userAta);
        const availableTokens = tokenBalance.value.uiAmount || 0;
        this.logger.log(`Available tokens: ${availableTokens}`);

        if (availableTokens < betAmount / Math.pow(10, 6)) {
          return {
            success: false,
            message: `Insufficient token balance! Need at least ${
              betAmount / Math.pow(10, 6)
            } tokens, but only have ${availableTokens}`,
          };
        }
      } catch (error) {
        this.logger.warn(`Could not check token balance: ${error.message}`);
      }

      // Check if token is whitelisted
      const whitelistedTokens = await program.account.whitelistedToken.all();
      const whitelistedToken = whitelistedTokens.find(
        (wt) =>
          wt.account.mint.toString() === MINT_PUBKEY.toString() &&
          wt.account.isWhitelisted
      );

      if (!whitelistedToken) {
        return {
          success: false,
          message: "Token is not whitelisted",
        };
      }

      this.logger.log(
        `Token is whitelisted: ${whitelistedToken.publicKey.toString()}`
      );

      // Get global config to determine if any games exist and get latest game info
      const configs = await program.account.generalConfig.all();
      const instructions: TransactionInstruction[] = [];

      let shouldStartNewGame = false;
      let gameToJoin = null;

      // Game parameters are now class properties

      if (configs.length === 0) {
        this.logger.log("No global config found. Cannot proceed.");
        return {
          success: false,
          message: "Global config not found on-chain",
        };
      }

      const globalConfig = configs[0];
      const currentGameNonce = globalConfig.account.gameNonce;

      if (currentGameNonce.isZero()) {
        this.logger.log("No games exist. Will start a new game.");
        shouldStartNewGame = true;
      } else {
        // Get the latest game using nonce
        const latestGameNonce = currentGameNonce.sub(new BN(1));
        const [latestGamePda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("boatkid"),
            latestGameNonce.toArrayLike(Buffer, "le", 8),
            Buffer.from("boatkid-game"),
          ],
          program.programId
        );

        try {
          const latestGameAccount = await program.account.generalGame.fetch(
            latestGamePda
          );
          const latestGame = {
            publicKey: latestGamePda,
            account: latestGameAccount,
          };

          this.logger.log(`Latest game status: ${latestGame.account.status}`);
          this.logger.log(
            `Latest game participants: ${latestGame.account.joinedParticipants}/${latestGame.account.maxAllowedParticipants}`
          );

          // Check if game is resolved
          if ("resolved" in latestGame.account.status) {
            this.logger.log("Latest game is resolved. Will start a new game.");
            shouldStartNewGame = true;
          }
          // Check if game is full
          else if (
            latestGame.account.joinedParticipants >=
            latestGame.account.maxAllowedParticipants
          ) {
            this.logger.log("Latest game is full. Will start a new game.");
            shouldStartNewGame = true;
          } else {
            this.logger.log(
              "Latest game can accept more players. Will join existing game."
            );
            gameToJoin = latestGame;
          }
        } catch (error) {
          this.logger.error("Failed to fetch latest game:", error);
          this.logger.log("Will start a new game.");
          shouldStartNewGame = true;
        }
      }

      if (shouldStartNewGame) {
        this.logger.log("Adding start game instruction");

        // Add start game instruction
        instructions.push(
          await program.methods
            .startGame(new BN(this.maxBetSize), this.maxParticipants)
            .accounts({
              operator: operatorKeypair.publicKey,
            })
            .instruction()
        );

        // For new game, derive the game PDA that will be created
        const [globalConfig] = await program.account.generalConfig.all();
        const gameNonce = globalConfig.account.gameNonce;

        const [gamePda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("boatkid"),
            gameNonce.toArrayLike(Buffer, "le", 8),
            Buffer.from("boatkid-game"),
          ],
          program.programId
        );

        gameToJoin = { publicKey: gamePda };
        this.logger.log(`New game PDA: ${gamePda.toString()}`);
      }

      this.logger.log("Adding join game instruction");

      // Add join game instruction
      instructions.push(
        await program.methods
          .joinGame(new BN(betAmount), new BN(usdAmount))
          .accounts({
            player: playerPubkey,
            game: gameToJoin.publicKey,
            operator: operatorKeypair.publicKey,
            whitelistedToken: whitelistedToken.publicKey,
            userAta: userAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

      // Get compute units for transaction optimization
      this.logger.log("Simulating transaction to get compute units");
      let units = await getSimulationUnits(
        connection,
        instructions,
        playerPubkey
      );

      // Fallback to default compute units if simulation fails
      if (units === undefined) {
        units = 200_000; // Default compute units for game transactions
        this.logger.warn(
          "Simulation failed, using default compute units: 200,000"
        );
      } else {
        this.logger.log(`Simulation successful, using compute units: ${units}`);
      }

      // Add compute budget instructions at the beginning
      const computeBudgetInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: Math.ceil(units * 1.05),
        }), // 5% margin of error
      ];

      // Combine compute budget instructions with game instructions
      const allInstructions = [...computeBudgetInstructions, ...instructions];

      // Build transaction
      const { transaction } = await prepareTransaction({
        payer: playerPubkey,
        instructions: allInstructions,
      });

      // Sign with operator keypair only (player will sign on frontend)
      transaction.partialSign(operatorKeypair);

      // Serialize transaction for frontend
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
      });

      const transactionBase58 = base58.encode(serializedTransaction);

      return {
        success: true,
        message: shouldStartNewGame
          ? "Transaction built successfully: START + JOIN game"
          : "Transaction built successfully: JOIN existing game",
        txn: transactionBase58,
        gameAddress: gameToJoin.publicKey.toString(),
        gameStatus: {
          isNewGame: shouldStartNewGame,
          gameAddress: gameToJoin.publicKey.toString(),
          betAmount: betAmount / Math.pow(10, 6),
          usdAmount: usdAmount,
        },
      };
    } catch (error) {
      this.logger.error("Error building join game transaction:", error);
      return {
        success: false,
        message: `Error building transaction: ${error.message}`,
      };
    }
  }

  async confirmTransaction(
    request: ConfirmTransactionRequest
  ): Promise<ConfirmTransactionResponse> {
    try {
      this.logger.log("Confirming transaction:", request.transactionId);

      // Setup connection
      const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );

      // Confirm transaction with proper commitment level
      await connection.confirmTransaction(request.transactionId, "finalized");

      this.logger.log(
        `Transaction ${request.transactionId} confirmed successfully`
      );

      // Sync latest on-chain data to Redis instead of manual updates
      this.logger.log(
        "Syncing on-chain data to Redis after transaction confirmation"
      );
      const syncResult = await this.syncOnChainDataToRedis();

      if (syncResult.success) {
        this.logger.log(
          `Successfully synced ${syncResult.syncedGames} games to Redis`
        );

        // Check player count and start timer if needed
        const currentGameState = await this.getCurrentGameState();
        if (currentGameState) {
          await this.gameTimerService.checkAndStartGameTimer(currentGameState);
        }

        // Broadcast new bet confirmation to all connected clients
        await this.broadcastBetConfirmation(request);
      } else {
        this.logger.warn(`Failed to sync on-chain data: ${syncResult.message}`);
      }

      return {
        confirmed: true,
        message: "Transaction confirmed and game state synced successfully",
      };
    } catch (error) {
      this.logger.error("Error confirming transaction:", error);

      // Check if it's a timeout or network error vs actual transaction failure
      if (
        error.message?.includes("Timeout") ||
        error.message?.includes("timeout")
      ) {
        return {
          confirmed: false,
          message:
            "Transaction confirmation timeout - it may still be processing",
        };
      }

      return {
        confirmed: false,
        message: `Transaction confirmation failed: ${error.message}`,
      };
    }
  }

  public async getCurrentGameState(): Promise<GameState | null> {
    try {
      const currentGameAddress = await this.redisService.get(CURRENT_GAME_KEY);
      if (!currentGameAddress) {
        return null;
      }

      const gameStateKey = `${GAME_STATE_KEY}:${currentGameAddress}`;
      const gameStateJson = await this.redisService.get(gameStateKey);

      return gameStateJson ? JSON.parse(gameStateJson) : null;
    } catch (error) {
      this.logger.error("Error getting current game state:", error);
      return null;
    }
  }

  public async getGamePlayers(gameAddress: string): Promise<GamePlayer[]> {
    try {
      const playersKey = `${GAME_PLAYERS_KEY}:${gameAddress}`;
      const playersJson = await this.redisService.get(playersKey);

      return playersJson ? JSON.parse(playersJson) : [];
    } catch (error) {
      this.logger.error("Error getting game players:", error);
      return [];
    }
  }

  public async syncOnChainDataToRedis(): Promise<{
    success: boolean;
    syncedGames: number;
    message: string;
  }> {
    try {
      this.logger.log("Starting on-chain data sync to Redis");

      // Setup connection and program
      const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );

      // Get operator keypair for program setup
      if (!process.env.OPERATOR_SK) {
        throw new Error("OPERATOR_SK environment variable is required");
      }

      const operatorKeypair = Keypair.fromSecretKey(
        new Uint8Array(base58.decode(process.env.OPERATOR_SK))
      );
      const readonlyWallet = new Wallet(operatorKeypair);
      const program = await getProgram(readonlyWallet, PROGRAM_ID, connection);

      // Get global config to get the latest game nonce
      const configs = await program.account.generalConfig.all();
      if (configs.length === 0) {
        return {
          success: true,
          syncedGames: 0,
          message: "No global config found on-chain",
        };
      }

      const globalConfig = configs[0];
      const currentGameNonce = globalConfig.account.gameNonce;

      // If no games have been created yet, the current nonce will be 0
      if (currentGameNonce.isZero()) {
        return {
          success: true,
          syncedGames: 0,
          message: "No games created yet",
        };
      }

      // The latest game nonce is currentGameNonce - 1 (since nonce increments after game creation)
      const latestGameNonce = currentGameNonce.sub(new BN(1));

      // Derive the latest game PDA
      const [latestGamePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("boatkid"),
          latestGameNonce.toArrayLike(Buffer, "le", 8),
          Buffer.from("boatkid-game"),
        ],
        program.programId
      );

      this.logger.log(
        `Fetching latest game with nonce ${latestGameNonce.toString()} at PDA ${latestGamePda.toString()}`
      );

      // Fetch the specific latest game
      let latestGame;
      try {
        latestGame = await program.account.generalGame.fetch(latestGamePda);
        latestGame = { publicKey: latestGamePda, account: latestGame };
        this.logger.log(`Successfully fetched latest game`);
      } catch (error) {
        this.logger.error("Failed to fetch latest game:", error);
        return {
          success: true,
          syncedGames: 0,
          message: "Latest game not found on-chain",
        };
      }

      // Fetch participants for the latest game
      const allGameBets = await program.account.gameBet.all();
      const gameParticipants = allGameBets.filter((bet) =>
        bet.account.game.equals(latestGame.publicKey)
      );

      this.logger.log(
        `Found ${gameParticipants.length} participants for latest game`
      );

      // Convert on-chain data to our format
      const onChainGameData: OnChainGameData = {
        publicKey: latestGame.publicKey.toString(),
        nonce: latestGame.account.nonce.toNumber(),
        totalBetAmount: latestGame.account.totalBetAmount.toNumber(),
        createdAt: latestGame.account.createdAt.toNumber() * 1000, // Convert to ms
        maxAllowedParticipants: latestGame.account.maxAllowedParticipants,
        status: this.mapOnChainStatus(latestGame.account.status),
        joinedParticipants: latestGame.account.joinedParticipants,
        maxBetSize: latestGame.account.maxBetSize.toNumber(),
        participants: gameParticipants.map((participant) => ({
          wallet: participant.account.user.toString(),
          betAmount: participant.account.amount.toNumber() / Math.pow(10, 6), // Convert from lamports
          joinedAt: participant.account.betAt.toNumber() * 1000, // Convert to ms
          tokenMint: participant.account.token.toString(),
          betPda: participant.publicKey.toString(),
        })),
      };

      // Sync to Redis
      await this.syncGameDataToRedis(onChainGameData);

      // Only sync the latest game for optimal performance
      const syncedCount = 1;

      this.logger.log(
        `Successfully synced ${syncedCount} games from on-chain to Redis`
      );

      return {
        success: true,
        syncedGames: syncedCount,
        message: `Successfully synced ${syncedCount} games from blockchain to Redis`,
      };
    } catch (error) {
      this.logger.error("Error syncing on-chain data to Redis:", error);
      return {
        success: false,
        syncedGames: 0,
        message: `Failed to sync on-chain data: ${error.message}`,
      };
    }
  }

  private async syncGameDataToRedis(
    onChainData: OnChainGameData
  ): Promise<void> {
    const gameAddress = onChainData.publicKey;
    const gameStateKey = `${GAME_STATE_KEY}:${gameAddress}`;
    const playersKey = `${GAME_PLAYERS_KEY}:${gameAddress}`;

    // Create GameState from on-chain data
    const gameState: GameState = {
      gameId: gameAddress,
      gameAddress: gameAddress,
      status: this.mapStatusForRedis(onChainData.status),
      maxParticipants: onChainData.maxAllowedParticipants,
      currentParticipants: onChainData.joinedParticipants,
      players: onChainData.participants,
      createdAt: onChainData.createdAt,
      updatedAt: Date.now(),
      maxBetSize: onChainData.maxBetSize / Math.pow(10, 6), // Convert to token amount
      totalPot: onChainData.totalBetAmount / Math.pow(10, 6), // Convert to token amount
      // On-chain specific data
      nonce: onChainData.nonce,
      onChainStatus: onChainData.status,
      lastSyncedAt: Date.now(),
    };

    // Store in Redis with 24 hour TTL
    await this.redisService.set(
      gameStateKey,
      JSON.stringify(gameState),
      this.redisTtl
    );

    // Store players separately
    await this.redisService.set(
      playersKey,
      JSON.stringify(onChainData.participants),
      this.redisTtl
    );

    // Update current game reference if this is the latest active game
    if (
      onChainData.status === "initialized" ||
      onChainData.status === "started"
    ) {
      await this.redisService.set(CURRENT_GAME_KEY, gameAddress, this.redisTtl);
    }

    // Cancel timer if game is resolved or full
    await this.gameTimerService.checkAndCancelTimer(
      gameAddress,
      onChainData.status,
      onChainData.joinedParticipants,
      onChainData.maxAllowedParticipants
    );

    this.logger.log(
      `Synced game ${gameAddress} to Redis: ${onChainData.joinedParticipants}/${onChainData.maxAllowedParticipants} players, Status: ${onChainData.status}`
    );

    // Broadcast game data update to connected clients
    await this.broadcastGameDataSync(gameState);
  }

  private mapOnChainStatus(
    status: any
  ): "initialized" | "started" | "resolved" {
    if ("initialized" in status) return "initialized";
    if ("started" in status) return "started";
    if ("resolved" in status) return "resolved";
    return "initialized"; // Default fallback
  }

  private mapStatusForRedis(
    onChainStatus: "initialized" | "started" | "resolved"
  ): "waiting" | "active" | "finished" {
    switch (onChainStatus) {
      case "initialized":
        return "waiting";
      case "started":
        return "active";
      case "resolved":
        return "finished";
      default:
        return "waiting";
    }
  }

  public async getLatestGameFromChain(): Promise<OnChainGameData | null> {
    try {
      const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );

      if (!process.env.OPERATOR_SK) {
        throw new Error("OPERATOR_SK environment variable is required");
      }

      const operatorKeypair = Keypair.fromSecretKey(
        new Uint8Array(base58.decode(process.env.OPERATOR_SK))
      );
      const readonlyWallet = new Wallet(operatorKeypair);
      const program = await getProgram(readonlyWallet, PROGRAM_ID, connection);

      // Get global config to get the latest game nonce
      const configs = await program.account.generalConfig.all();
      if (configs.length === 0) return null;

      const globalConfig = configs[0];
      const currentGameNonce = globalConfig.account.gameNonce;

      // If no games have been created yet, return null
      if (currentGameNonce.isZero()) return null;

      // The latest game nonce is currentGameNonce - 1
      const latestGameNonce = currentGameNonce.sub(new BN(1));

      // Derive the latest game PDA
      const [latestGamePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("boatkid"),
          latestGameNonce.toArrayLike(Buffer, "le", 8),
          Buffer.from("boatkid-game"),
        ],
        program.programId
      );

      // Fetch the specific latest game
      const latestGameAccount = await program.account.generalGame.fetch(
        latestGamePda
      );
      const latestGame = {
        publicKey: latestGamePda,
        account: latestGameAccount,
      };

      const allGameBets = await program.account.gameBet.all();
      const gameParticipants = allGameBets.filter((bet) =>
        bet.account.game.equals(latestGame.publicKey)
      );

      return {
        publicKey: latestGame.publicKey.toString(),
        nonce: latestGame.account.nonce.toNumber(),
        totalBetAmount: latestGame.account.totalBetAmount.toNumber(),
        createdAt: latestGame.account.createdAt.toNumber() * 1000,
        maxAllowedParticipants: latestGame.account.maxAllowedParticipants,
        status: this.mapOnChainStatus(latestGame.account.status),
        joinedParticipants: latestGame.account.joinedParticipants,
        maxBetSize: latestGame.account.maxBetSize.toNumber(),
        participants: gameParticipants.map((participant) => ({
          wallet: participant.account.user.toString(),
          betAmount: participant.account.amount.toNumber() / Math.pow(10, 6),
          joinedAt: participant.account.betAt.toNumber() * 1000,
          tokenMint: participant.account.token.toString(),
          betPda: participant.publicKey.toString(),
        })),
      };
    } catch (error) {
      this.logger.error("Error fetching latest game from chain:", error);
      return null;
    }
  }

  // Broadcast bet confirmation to connected clients
  private async broadcastBetConfirmation(
    request: ConfirmTransactionRequest
  ): Promise<void> {
    try {
      // Get current game state to include in the broadcast
      const currentGameState = await this.getCurrentGameState();

      if (currentGameState) {
        // Broadcast to main game channel
        await this.pusherService.broadcastGameUpdate("bet-confirmed", {
          transactionId: request.transactionId,
          wallet: request.wallet,
          betAmount: request.betAmount,
          gameAddress: request.gameAddress || currentGameState.gameAddress,
          gameState: currentGameState,
          timestamp: Date.now(),
        });

        // Also broadcast to specific game channel if gameAddress is provided
        if (request.gameAddress) {
          await this.pusherService.broadcastToGameChannel(
            request.gameAddress,
            "player-joined",
            {
              transactionId: request.transactionId,
              wallet: request.wallet,
              betAmount: request.betAmount,
              currentParticipants: currentGameState.currentParticipants,
              maxParticipants: currentGameState.maxParticipants,
              gameStatus: currentGameState.status,
              timestamp: Date.now(),
            }
          );
        }

        this.logger.log(
          `Broadcasted bet confirmation for transaction ${request.transactionId} to ${currentGameState.currentParticipants}/${currentGameState.maxParticipants} game`
        );
      }
    } catch (error) {
      this.logger.error("Error broadcasting bet confirmation:", error);
      // Don't throw - broadcasting errors shouldn't fail the transaction confirmation
    }
  }

  // Broadcast game state changes (can be called when games start, end, etc.)
  public async broadcastGameStateChange(
    event: string,
    gameState: GameState,
    additionalData?: any
  ): Promise<void> {
    try {
      const broadcastData = {
        event,
        gameState,
        timestamp: Date.now(),
        ...additionalData,
      };

      // Broadcast to main game channel
      await this.pusherService.broadcastGameUpdate(
        "game-state-changed",
        broadcastData
      );

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameState.gameAddress,
        event,
        broadcastData
      );

      this.logger.log(
        `Broadcasted game state change: ${event} for game ${gameState.gameAddress}`
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting game state change (${event}):`,
        error
      );
    }
  }

  // Broadcast when game data is synced from blockchain to Redis
  private async broadcastGameDataSync(gameState: GameState): Promise<void> {
    try {
      // Broadcast to main game channel for wheel updates
      await this.pusherService.broadcastGameUpdate("game-data-synced", {
        gameState,
        syncedAt: Date.now(),
      });

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameState.gameAddress,
        "data-synced",
        {
          gameState,
          syncedAt: Date.now(),
        }
      );

      this.logger.debug(
        `Broadcasted game data sync for game ${gameState.gameAddress} - ${gameState.currentParticipants}/${gameState.maxParticipants} players`
      );
    } catch (error) {
      this.logger.error("Error broadcasting game data sync:", error);
    }
  }

  // Add convenience methods to access timer functionality through UserService
  public async getGameTimerStatus(): Promise<{
    gameAddress: string | null;
    timer: any | null;
    remainingTime: number | null;
    remainingSeconds: number | null;
  }> {
    const currentGameState = await this.getCurrentGameState();
    return this.gameTimerService.getGameTimerStatus(currentGameState);
  }

  public async cancelGameTimer(gameAddress: string): Promise<void> {
    return this.gameTimerService.cancelGameTimer(gameAddress);
  }

  public async restoreGameTimers(): Promise<void> {
    const currentGameState = await this.getCurrentGameState();
    if (currentGameState) {
      await this.gameTimerService.restoreTimerForGame(currentGameState);
    }
  }
}
