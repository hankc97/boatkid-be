import { Injectable, Logger } from "@nestjs/common";
import { withDB } from "../../kysely/db";

export interface HistoricalStats {
  totalBets: string;
  totalGames: number;
}

@Injectable()
export class HistoricalService {
  private readonly logger = new Logger(HistoricalService.name);

  /**
   * Get historical game statistics
   */
  async getGameStatistics(): Promise<HistoricalStats> {
    try {
      return await withDB(async (db) => {
        const stats = await db
          .selectFrom("boatkid_historical_games")
          .select([
            (eb) => eb.fn.count("id").as("total_games"),
            (eb) => eb.fn.sum("total_prize_pool").as("total_bets"),
          ])
          .executeTakeFirstOrThrow();

        return {
          totalGames: Number(stats.total_games) || 0,
          totalBets: stats.total_bets?.toString() || "0",
        };
      });
    } catch (error) {
      this.logger.error("Error fetching historical game statistics:", error);
      throw error;
    }
  }
}
