import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { HistoricalService } from "./historical.service";

@Controller("historical")
export class HistoricalController {
  private readonly logger = new Logger(HistoricalController.name);

  constructor(private readonly historicalService: HistoricalService) {}

  @Get("stats")
  @HttpCode(HttpStatus.OK)
  async getGameStatistics(): Promise<{
    totalBets: string;
    totalGames: number;
  }> {
    try {
      this.logger.log("Fetching historical game statistics");

      const stats = await this.historicalService.getGameStatistics();

      this.logger.log(
        `Retrieved stats: ${stats.totalGames} games, ${stats.totalBets} total bets`
      );

      return {
        totalBets: stats.totalBets,
        totalGames: stats.totalGames,
      };
    } catch (error) {
      this.logger.error("Failed to fetch historical game statistics:", error);
      throw new InternalServerErrorException(
        "Failed to retrieve historical statistics"
      );
    }
  }
}
