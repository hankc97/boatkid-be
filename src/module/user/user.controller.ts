import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsNotEmpty,
} from "class-validator";
import { Expose } from "class-transformer";
import { PublicKey } from "@solana/web3.js";
import {
  UserService,
  JoinGameRequest,
  JoinGameResponse,
  ConfirmTransactionRequest,
  GameState,
  GamePlayer,
  OnChainGameData,
} from "./user.service";

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: "wallet" })
  wallet: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  @Expose({ name: "betAmount" })
  betAmount?: number;
}

export class ConfirmTransactionDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: "transactionId" })
  transactionId: string;

  @IsString()
  @IsNotEmpty()
  @Expose({ name: "wallet" })
  wallet: string;

  @IsOptional()
  @IsNumber()
  @Expose({ name: "betAmount" })
  betAmount?: number;

  @IsOptional()
  @IsString()
  @Expose({ name: "gameAddress" })
  gameAddress?: string;
}

@Controller("user")
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post("join-game")
  @HttpCode(HttpStatus.OK)
  async joinGame(@Body() joinGameDto: JoinGameDto): Promise<JoinGameResponse> {
    try {
      this.logger.log("Received join game request");
      this.logger.log("Request body:", JSON.stringify(joinGameDto));

      // Validate wallet address format
      try {
        new PublicKey(joinGameDto.wallet);
      } catch (error) {
        throw new BadRequestException(
          "wallet must be a valid Solana public key"
        );
      }

      const request: JoinGameRequest = {
        wallet: joinGameDto.wallet,
        betAmount: joinGameDto.betAmount,
      };

      const result = await this.userService.joinGameWithStartGame(request);

      this.logger.log(
        `Join game result: ${result.success ? "SUCCESS" : "FAILED"}`
      );

      return result;
    } catch (error) {
      this.logger.error("Error in joinGame controller:", error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while joining the game"
      );
    }
  }

  @Post("confirm-transaction")
  @HttpCode(HttpStatus.OK)
  async confirmTransaction(
    @Body() confirmTransactionDto: ConfirmTransactionDto
  ): Promise<{ confirmed: boolean; message?: string }> {
    try {
      this.logger.log("Received transaction confirmation request");
      this.logger.log("Request body:", JSON.stringify(confirmTransactionDto));

      // Validate wallet address format
      try {
        new PublicKey(confirmTransactionDto.wallet);
      } catch (error) {
        throw new BadRequestException(
          "wallet must be a valid Solana public key"
        );
      }

      const request: ConfirmTransactionRequest = {
        transactionId: confirmTransactionDto.transactionId,
        wallet: confirmTransactionDto.wallet,
        betAmount: confirmTransactionDto.betAmount,
        gameAddress: confirmTransactionDto.gameAddress,
      };

      const result = await this.userService.confirmTransaction(request);

      this.logger.log(
        `Transaction confirmation result: ${
          result.confirmed ? "SUCCESS" : "FAILED"
        }`
      );

      return result;
    } catch (error) {
      this.logger.error("Error in confirmTransaction controller:", error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while confirming the transaction"
      );
    }
  }

  @Get("current-game-state")
  @HttpCode(HttpStatus.OK)
  async getCurrentGameState(): Promise<GameState | null> {
    try {
      this.logger.log("Retrieving current game state");
      const gameState = await this.userService.getCurrentGameState();

      this.logger.log(
        gameState
          ? `Found game state: ${gameState.currentParticipants}/${gameState.maxParticipants} players, Status: ${gameState.status}`
          : "No current game state found"
      );

      return gameState;
    } catch (error) {
      this.logger.error("Error getting current game state:", error);
      throw new InternalServerErrorException(
        "An unexpected error occurred while retrieving game state"
      );
    }
  }

  @Get("game-players/:gameAddress")
  @HttpCode(HttpStatus.OK)
  async getGamePlayers(
    @Param("gameAddress") gameAddress: string
  ): Promise<GamePlayer[]> {
    try {
      this.logger.log("Retrieving game players for:", gameAddress);

      // Validate game address format
      try {
        new PublicKey(gameAddress);
      } catch (error) {
        throw new BadRequestException(
          "gameAddress must be a valid Solana public key"
        );
      }

      const players = await this.userService.getGamePlayers(gameAddress);

      this.logger.log(
        `Found ${players.length} players for game ${gameAddress}`
      );

      return players;
    } catch (error) {
      this.logger.error("Error getting game players:", error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while retrieving game players"
      );
    }
  }

  @Post("sync-onchain-data")
  @HttpCode(HttpStatus.OK)
  async syncOnChainData(): Promise<{
    success: boolean;
    syncedGames: number;
    message: string;
  }> {
    try {
      this.logger.log("Starting on-chain data sync");

      const result = await this.userService.syncOnChainDataToRedis();

      this.logger.log(
        `Sync completed: ${result.success ? "SUCCESS" : "FAILED"} - ${
          result.message
        }`
      );

      return result;
    } catch (error) {
      this.logger.error("Error syncing on-chain data:", error);
      throw new InternalServerErrorException(
        "An unexpected error occurred while syncing on-chain data"
      );
    }
  }

  @Get("latest-game-onchain")
  @HttpCode(HttpStatus.OK)
  async getLatestGameFromChain(): Promise<OnChainGameData | null> {
    try {
      this.logger.log("Fetching latest game from blockchain");

      const latestGame = await this.userService.getLatestGameFromChain();

      this.logger.log(
        latestGame
          ? `Found latest game: ${latestGame.publicKey} with ${latestGame.joinedParticipants}/${latestGame.maxAllowedParticipants} players`
          : "No games found on blockchain"
      );

      return latestGame;
    } catch (error) {
      this.logger.error("Error fetching latest game from chain:", error);
      throw new InternalServerErrorException(
        "An unexpected error occurred while fetching latest game from blockchain"
      );
    }
  }

  @Get("timer-status")
  @HttpCode(HttpStatus.OK)
  async getTimerStatus(): Promise<{
    gameAddress: string | null;
    timer: any | null;
    remainingTime: number | null;
    remainingSeconds: number | null;
  }> {
    this.logger.log("Getting timer status");
    return this.userService.getGameTimerStatus();
  }

  @Post("health")
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; message: string }> {
    return {
      status: "ok",
      message: "User service is healthy",
    };
  }
}
