import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { IsString, IsNotEmpty } from "class-validator";
import { Expose } from "class-transformer";
import { AdminService, GameResolutionResult } from "./admin.service";

export class ResolveGameDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: "gameAddress" })
  gameAddress: string;
}

@Controller("admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  @Post("resolve-game")
  @HttpCode(HttpStatus.OK)
  async resolveGame(
    @Body() dto: ResolveGameDto
  ): Promise<GameResolutionResult> {
    try {
      this.logger.log(`Resolving game: ${dto.gameAddress}`);

      const result = await this.adminService.resolveGame(dto.gameAddress);

      this.logger.log(`Game resolved successfully: ${dto.gameAddress}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to resolve game ${dto.gameAddress}:`, error);

      if (error.message?.includes("Account does not exist")) {
        throw new BadRequestException("Game not found or already resolved");
      }

      if (error.message?.includes("Game cannot be resolved")) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        "Failed to resolve game. Please try again."
      );
    }
  }
}
