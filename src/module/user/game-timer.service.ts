import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import { PusherService } from "../pusher/pusher.service";
import {
  GAME_STATE_KEY,
  GAME_TIMER_KEY,
  GAME_TIMER_STARTED_KEY,
} from "../redis/redis.keys";
import { AdminService, GameResolutionResult } from "../admin/admin.service";
import {
  DatabaseService,
  GameStorageData,
} from "../../kysely/database.service";

export interface GameTimer {
  gameAddress: string;
  startedAt: number;
  endsAt: number;
  duration: number;
  isActive: boolean;
}

export interface GameState {
  gameId: string;
  gameAddress: string;
  status: "waiting" | "active" | "finished";
  maxParticipants: number;
  currentParticipants: number;
  players: any[];
  createdAt: number;
  updatedAt: number;
  maxBetSize: number;
  totalPot: number;
  nonce?: number;
  onChainStatus?: "initialized" | "started" | "resolved";
  lastSyncedAt?: number;
  // Timer data
  timerStartedAt?: number;
  timerEndsAt?: number;
  timerDuration?: number;
}

@Injectable()
export class GameTimerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameTimerService.name);
  private readonly activeTimers = new Map<
    string,
    {
      intervalId: NodeJS.Timeout;
      timeoutId: NodeJS.Timeout;
    }
  >();
  private readonly TIMER_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  // private readonly TIMER_DURATION = 30000; // 30 seconds in milliseconds

  constructor(
    private readonly redisService: RedisService,
    private readonly pusherService: PusherService,
    private readonly adminService: AdminService,
    private readonly databaseService: DatabaseService
  ) {}

  // Called after module initialization to restore active timers
  async onModuleInit(): Promise<void> {
    try {
      await this.restoreActiveTimers();
    } catch (error) {
      this.logger.error("Error restoring active timers on module init:", error);
    }
  }

  // Called before module destruction to clean up timers
  async onModuleDestroy(): Promise<void> {
    try {
      // Clear all active timers
      for (const [gameAddress, timers] of this.activeTimers) {
        clearInterval(timers.intervalId);
        clearTimeout(timers.timeoutId);
        this.logger.log(
          `Cleared timer for game ${gameAddress} on module destroy`
        );
      }
      this.activeTimers.clear();
    } catch (error) {
      this.logger.error("Error cleaning up timers on module destroy:", error);
    }
  }

  // Check player count and start timer if 2 players are in the game
  async checkAndStartGameTimer(gameState: GameState): Promise<void> {
    try {
      if (!gameState) {
        this.logger.debug("No game state provided");
        return;
      }

      this.logger.log(
        `Checking timer for game ${gameState.gameAddress}: ${gameState.currentParticipants} players`
      );

      // Only start timer if exactly 2 players and game is still waiting/active
      if (
        gameState.currentParticipants >= 2 &&
        (gameState.status === "waiting" || gameState.status === "active")
      ) {
        await this.startOrResetGameTimer(gameState.gameAddress);
      }
    } catch (error) {
      this.logger.error("Error checking and starting game timer:", error);
    }
  }

  // Start or reset the auto-resolution timer for a game (resets to full duration if already running)
  async startOrResetGameTimer(gameAddress: string): Promise<void> {
    try {
      // Check if timer already exists
      const timerStartedKey = `${GAME_TIMER_STARTED_KEY}:${gameAddress}`;
      const timerAlreadyStarted = await this.redisService.get(timerStartedKey);

      if (timerAlreadyStarted) {
        this.logger.log(
          `Timer already running for game ${gameAddress} - resetting to full duration (${
            this.TIMER_DURATION / 1000
          }s)`
        );

        // Cancel the existing timer
        await this.cancelGameTimer(gameAddress);

        // Broadcast timer reset event
        await this.broadcastTimerReset(gameAddress);
      }

      // Start a fresh timer (either new or reset)
      await this.startGameTimer(gameAddress);
    } catch (error) {
      this.logger.error(
        `Error starting or resetting game timer for ${gameAddress}:`,
        error
      );
    }
  }

  // Start the auto-resolution timer for a game
  async startGameTimer(gameAddress: string): Promise<void> {
    try {
      // Check if timer already started for this game
      const timerStartedKey = `${GAME_TIMER_STARTED_KEY}:${gameAddress}`;
      const timerAlreadyStarted = await this.redisService.get(timerStartedKey);

      if (timerAlreadyStarted) {
        this.logger.log(`Timer already started for game ${gameAddress}`);
        return;
      }

      // Mark timer as started in Redis to prevent duplicate timers
      await this.redisService.set(timerStartedKey, "true", 300); // 5 minutes TTL

      const now = Date.now();
      const endsAt = now + this.TIMER_DURATION;

      // Create timer object
      const gameTimer: GameTimer = {
        gameAddress,
        startedAt: now,
        endsAt,
        duration: this.TIMER_DURATION,
        isActive: true,
      };

      // Store timer in Redis
      const timerKey = `${GAME_TIMER_KEY}:${gameAddress}`;
      await this.redisService.set(
        timerKey,
        JSON.stringify(gameTimer),
        Math.ceil(this.TIMER_DURATION / 1000) + 30 // TTL slightly longer than timer duration
      );

      // Update game state with timer info
      await this.updateGameStateWithTimer(gameAddress, gameTimer);

      this.logger.log(
        `Started auto-resolution timer for game ${gameAddress} - will resolve in ${
          this.TIMER_DURATION / 1000
        } seconds`
      );

      // Broadcast timer started event
      await this.broadcastTimerStarted(gameAddress, gameTimer);

      // Start the actual countdown timer
      await this.startCountdownTimer(gameAddress, gameTimer);
    } catch (error) {
      this.logger.error(`Error starting game timer for ${gameAddress}:`, error);
    }
  }

  // Start countdown timer with regular broadcasts
  private async startCountdownTimer(
    gameAddress: string,
    gameTimer: GameTimer
  ): Promise<void> {
    // Clear any existing timers for this game
    if (this.activeTimers.has(gameAddress)) {
      const existingTimers = this.activeTimers.get(gameAddress);
      clearInterval(existingTimers.intervalId);
      clearTimeout(existingTimers.timeoutId);
    }

    // Broadcast every 1 seconds
    const broadcastInterval = 1000;

    const intervalId = setInterval(async () => {
      try {
        const now = Date.now();
        const remainingTime = gameTimer.endsAt - now;

        if (remainingTime <= 0) {
          // Timer expired - trigger game resolution
          await this.handleTimerExpiration(gameAddress);
          // Note: handleTimerExpiration already clears the timers
          return;
        }

        // Broadcast timer update
        await this.broadcastTimerUpdate(gameAddress, remainingTime);
      } catch (error) {
        this.logger.error(
          `Error in countdown timer for ${gameAddress}:`,
          error
        );
      }
    }, broadcastInterval);

    // Also set a final timeout to ensure cleanup
    const timeoutId = setTimeout(async () => {
      try {
        await this.handleTimerExpiration(gameAddress);
        if (this.activeTimers.has(gameAddress)) {
          const timers = this.activeTimers.get(gameAddress);
          clearInterval(timers.intervalId);
          clearTimeout(timers.timeoutId);
          this.activeTimers.delete(gameAddress);
        }
      } catch (error) {
        this.logger.error(
          `Error in timer expiration for ${gameAddress}:`,
          error
        );
      }
    }, this.TIMER_DURATION + 1000); // Add 1 second buffer

    // Store both the interval and timeout IDs
    this.activeTimers.set(gameAddress, { intervalId, timeoutId });
  }

  // Update game state with timer information
  private async updateGameStateWithTimer(
    gameAddress: string,
    gameTimer: GameTimer
  ): Promise<void> {
    try {
      const gameStateKey = `${GAME_STATE_KEY}:${gameAddress}`;
      const gameStateJson = await this.redisService.get(gameStateKey);

      if (gameStateJson) {
        const gameState: GameState = JSON.parse(gameStateJson);

        // Add timer data
        gameState.timerStartedAt = gameTimer.startedAt;
        gameState.timerEndsAt = gameTimer.endsAt;
        gameState.timerDuration = gameTimer.duration;
        gameState.updatedAt = Date.now();

        // Save updated game state
        await this.redisService.set(
          gameStateKey,
          JSON.stringify(gameState),
          60 * 60 * 2 // 2 hours TTL
        );

        this.logger.log(
          `Updated game state with timer info for ${gameAddress}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating game state with timer for ${gameAddress}:`,
        error
      );
    }
  }

  // Handle timer expiration
  private async handleTimerExpiration(gameAddress: string): Promise<void> {
    try {
      this.logger.log(
        `Timer expired for game ${gameAddress} - triggering auto-resolution`
      );

      // Clear both interval and timeout timers immediately to prevent multiple calls
      if (this.activeTimers.has(gameAddress)) {
        const timers = this.activeTimers.get(gameAddress);
        clearInterval(timers.intervalId);
        clearTimeout(timers.timeoutId);
        this.activeTimers.delete(gameAddress);
      }

      // Clean up timer state from Redis
      const timerKey = `${GAME_TIMER_KEY}:${gameAddress}`;
      const timerStartedKey = `${GAME_TIMER_STARTED_KEY}:${gameAddress}`;

      await Promise.all([
        this.redisService.del(timerKey),
        this.redisService.del(timerStartedKey),
      ]);

      // Broadcast timer expired event
      await this.broadcastTimerExpired(gameAddress);

      // Trigger actual game resolution using AdminService
      this.logger.log(
        `🎲 Game ${gameAddress} auto-resolution triggered by timer expiration`
      );

      try {
        const result = await this.adminService.resolveGame(gameAddress);
        this.logger.log(
          `✅ Game ${gameAddress} resolved successfully by timer - Winner: ${result.winner}, TX: ${result.transactionSignature}`
        );

        // Store game data in PostgreSQL and broadcast only if not already stored
        const alreadyStored = await this.databaseService.isGameAlreadyStored(
          gameAddress
        );
        if (!alreadyStored) {
          // Store game data in PostgreSQL
          await this.storeGameInDatabase(gameAddress, result, true);
        } else {
          this.logger.log(
            `🔄 Game ${gameAddress} already processed, skipping storage into postgres`
          );
        }

        // Broadcast game resolution success to clients
        await this.broadcastGameResolved(gameAddress, result);
      } catch (resolutionError) {
        if (
          resolutionError.message?.includes(
            "Game resolution already in progress"
          )
        ) {
          this.logger.log(
            `⚡ Game ${gameAddress} resolution already in progress, skipping timer-triggered resolution`
          );
        } else if (
          resolutionError.message?.includes("Game cannot be resolved")
        ) {
          this.logger.log(
            `🏁 Game ${gameAddress} was already resolved, timer cleanup completed`
          );
        } else {
          this.logger.error(
            `❌ Failed to resolve game ${gameAddress} automatically:`,
            resolutionError
          );
          // Game resolution failed - could implement retry logic or manual intervention alerts here
        }

        // For any resolution error, we should not attempt storage or broadcast
        // as the game state is unclear or already handled
      }
    } catch (error) {
      this.logger.error(
        `Error handling timer expiration for ${gameAddress}:`,
        error
      );
    }
  }

  // Broadcast timer started event
  private async broadcastTimerStarted(
    gameAddress: string,
    gameTimer: GameTimer
  ): Promise<void> {
    try {
      const broadcastData = {
        gameAddress,
        timer: gameTimer,
        remainingTime: gameTimer.duration,
        message: `Auto-resolution timer started - game will resolve automatically in ${
          this.TIMER_DURATION / 1000
        } seconds`,
        timestamp: Date.now(),
      };

      // Broadcast to main game channel
      await this.pusherService.broadcastGameUpdate(
        "timer-started",
        broadcastData
      );

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameAddress,
        "timer-started",
        broadcastData
      );

      this.logger.log(`Broadcasted timer started for game ${gameAddress}`);
    } catch (error) {
      this.logger.error(
        `Error broadcasting timer started for ${gameAddress}:`,
        error
      );
    }
  }

  // Broadcast timer update
  private async broadcastTimerUpdate(
    gameAddress: string,
    remainingTime: number
  ): Promise<void> {
    try {
      const broadcastData = {
        gameAddress,
        remainingTime,
        remainingSeconds: Math.ceil(remainingTime / 1000),
        timestamp: Date.now(),
      };

      // Broadcast to main game channel
      await this.pusherService.broadcastGameUpdate(
        "timer-update",
        broadcastData
      );

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameAddress,
        "timer-update",
        broadcastData
      );

      this.logger.debug(
        `Timer update for game ${gameAddress}: ${Math.ceil(
          remainingTime / 1000
        )}s remaining`
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting timer update for ${gameAddress}:`,
        error
      );
    }
  }

  // Broadcast timer expired event
  private async broadcastTimerExpired(gameAddress: string): Promise<void> {
    try {
      const broadcastData = {
        gameAddress,
        message: "Timer expired - game is being resolved automatically",
        timestamp: Date.now(),
      };

      // Broadcast to main game channel
      await this.pusherService.broadcastGameUpdate(
        "timer-expired",
        broadcastData
      );

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameAddress,
        "timer-expired",
        broadcastData
      );

      this.logger.log(`Broadcasted timer expired for game ${gameAddress}`);
    } catch (error) {
      this.logger.error(
        `Error broadcasting timer expired for ${gameAddress}:`,
        error
      );
    }
  }

  // Broadcast game resolved event
  private async broadcastGameResolved(
    gameAddress: string,
    resolutionResult: GameResolutionResult
  ): Promise<void> {
    try {
      const broadcastData = {
        gameAddress,
        winner: resolutionResult.winner,
        transactionSignature: resolutionResult.transactionSignature,
        participants: resolutionResult.participants,
        totalPrizePool: resolutionResult.totalPrizePool,
        success: resolutionResult.success,
        message: `Game resolved! Winner: ${resolutionResult.winner}`,
        timestamp: Date.now(),
      };

      // Broadcast to main game channel
      await this.pusherService.broadcastGameUpdate(
        "game-resolved",
        broadcastData
      );

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameAddress,
        "game-resolved",
        broadcastData
      );

      this.logger.log(
        `Broadcasted game resolved for game ${gameAddress} - Winner: ${resolutionResult.winner}`
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting game resolved for ${gameAddress}:`,
        error
      );
    }
  }

  // Broadcast timer reset event
  private async broadcastTimerReset(gameAddress: string): Promise<void> {
    try {
      const broadcastData = {
        gameAddress,
        message: `Timer reset to ${
          this.TIMER_DURATION / 1000
        } seconds due to new transaction`,
        duration: this.TIMER_DURATION,
        timestamp: Date.now(),
      };

      // Broadcast to main game channel
      await this.pusherService.broadcastGameUpdate(
        "timer-reset",
        broadcastData
      );

      // Broadcast to specific game channel
      await this.pusherService.broadcastToGameChannel(
        gameAddress,
        "timer-reset",
        broadcastData
      );

      this.logger.log(`Broadcasted timer reset for game ${gameAddress}`);
    } catch (error) {
      this.logger.error(
        `Error broadcasting timer reset for ${gameAddress}:`,
        error
      );
    }
  }

  // Get timer state for a game
  async getGameTimer(gameAddress: string): Promise<GameTimer | null> {
    try {
      const timerKey = `${GAME_TIMER_KEY}:${gameAddress}`;
      const timerJson = await this.redisService.get(timerKey);

      return timerJson ? JSON.parse(timerJson) : null;
    } catch (error) {
      this.logger.error(`Error getting game timer for ${gameAddress}:`, error);
      return null;
    }
  }

  // Get current game timer status (for API endpoints)
  async getGameTimerStatus(gameState: GameState | null): Promise<{
    gameAddress: string | null;
    timer: GameTimer | null;
    remainingTime: number | null;
    remainingSeconds: number | null;
  }> {
    try {
      if (!gameState) {
        return {
          gameAddress: null,
          timer: null,
          remainingTime: null,
          remainingSeconds: null,
        };
      }

      const timer = await this.getGameTimer(gameState.gameAddress);

      if (!timer) {
        return {
          gameAddress: gameState.gameAddress,
          timer: null,
          remainingTime: null,
          remainingSeconds: null,
        };
      }

      const now = Date.now();
      const remainingTime = timer.endsAt - now;

      return {
        gameAddress: gameState.gameAddress,
        timer,
        remainingTime: remainingTime > 0 ? remainingTime : 0,
        remainingSeconds:
          remainingTime > 0 ? Math.ceil(remainingTime / 1000) : 0,
      };
    } catch (error) {
      this.logger.error("Error getting game timer status:", error);
      return {
        gameAddress: null,
        timer: null,
        remainingTime: null,
        remainingSeconds: null,
      };
    }
  }

  // Cancel timer for a game (useful if game gets resolved manually or reaches max players)
  async cancelGameTimer(gameAddress: string): Promise<void> {
    try {
      // Clear both interval and timeout timers
      if (this.activeTimers.has(gameAddress)) {
        const timers = this.activeTimers.get(gameAddress);
        clearInterval(timers.intervalId);
        clearTimeout(timers.timeoutId);
        this.activeTimers.delete(gameAddress);
      }

      // Clean up Redis state
      const timerKey = `${GAME_TIMER_KEY}:${gameAddress}`;
      const timerStartedKey = `${GAME_TIMER_STARTED_KEY}:${gameAddress}`;

      await Promise.all([
        this.redisService.del(timerKey),
        this.redisService.del(timerStartedKey),
      ]);

      // Broadcast timer cancelled event
      await this.pusherService.broadcastGameUpdate("timer-cancelled", {
        gameAddress,
        message: "Auto-resolution timer cancelled",
        timestamp: Date.now(),
      });

      this.logger.log(`Cancelled timer for game ${gameAddress}`);
    } catch (error) {
      this.logger.error(`Error cancelling timer for ${gameAddress}:`, error);
    }
  }

  // Check if a game should have its timer cancelled (resolved or full)
  async checkAndCancelTimer(
    gameAddress: string,
    onChainStatus: "initialized" | "started" | "resolved",
    joinedParticipants: number,
    maxAllowedParticipants: number
  ): Promise<void> {
    try {
      // Cancel timer if game is resolved or full
      if (
        onChainStatus === "resolved" ||
        joinedParticipants >= maxAllowedParticipants
      ) {
        await this.cancelGameTimer(gameAddress);
      }
    } catch (error) {
      this.logger.error(
        `Error checking and cancelling timer for ${gameAddress}:`,
        error
      );
    }
  }

  // Restore active timers from Redis after server restart
  private async restoreActiveTimers(): Promise<void> {
    try {
      this.logger.log("Restoring active timers from Redis...");

      // We'll need to get the current game state from the calling service
      // For now, we'll skip restoration since we don't have direct access to UserService
      // This can be called from UserService after it initializes

      this.logger.log("Timer restoration requires game state from UserService");
    } catch (error) {
      this.logger.error("Error restoring active timers:", error);
    }
  }

  // Public method to restore a specific timer (called by UserService)
  async restoreTimerForGame(gameState: GameState): Promise<void> {
    try {
      // Check if there's an active timer for this game
      const gameTimer = await this.getGameTimer(gameState.gameAddress);

      if (!gameTimer) {
        this.logger.debug(`No timer found for game ${gameState.gameAddress}`);
        return;
      }

      const now = Date.now();
      const remainingTime = gameTimer.endsAt - now;

      if (remainingTime <= 0) {
        // Timer already expired, trigger resolution
        this.logger.log(
          `Timer for game ${gameState.gameAddress} already expired, triggering resolution`
        );
        await this.handleTimerExpiration(gameState.gameAddress);
        return;
      }

      // Timer still active, restore countdown
      this.logger.log(
        `Restoring timer for game ${gameState.gameAddress} with ${Math.ceil(
          remainingTime / 1000
        )}s remaining`
      );

      // Update the timer object with current remaining time
      const restoredTimer: GameTimer = {
        ...gameTimer,
        endsAt: now + remainingTime, // Adjust end time to current time + remaining
      };

      await this.startCountdownTimer(gameState.gameAddress, restoredTimer);

      // Broadcast timer restoration
      await this.broadcastTimerStarted(gameState.gameAddress, restoredTimer);
    } catch (error) {
      this.logger.error(
        `Error restoring timer for game ${gameState.gameAddress}:`,
        error
      );
    }
  }

  // Store game data in PostgreSQL after resolution
  private async storeGameInDatabase(
    gameAddress: string,
    resolutionResult: GameResolutionResult,
    autoResolved: boolean
  ): Promise<void> {
    try {
      // Get current game state from Redis
      const gameStateKey = `${GAME_STATE_KEY}:${gameAddress}`;
      const gameStateJson = await this.redisService.get(gameStateKey);

      if (!gameStateJson) {
        this.logger.warn(
          `No game state found in Redis for ${gameAddress}, skipping database storage`
        );
        return;
      }

      const gameState: GameState = JSON.parse(gameStateJson);

      // Get timer information
      const gameTimer = await this.getGameTimer(gameAddress);

      // Get participant data - we need to fetch this from the admin service or blockchain
      // For now, we'll use the game state players, but ideally we'd get the full participant data
      const participants = gameState.players || [];

      // Create storage data
      const storageData: GameStorageData = {
        gameState,
        resolutionResult,
        participants: participants.map((player, index) => ({
          publicKey: { toString: () => player.betPda || `unknown-${index}` },
          account: {
            user: { toString: () => player.walletAddress },
            amount: { toNumber: () => player.betAmount * Math.pow(10, 6) }, // Convert back to raw amount
            token: { toString: () => player.tokenMint },
            game: { toString: () => gameAddress },
          },
        })),
        autoResolved,
        timerStartedAt: gameTimer?.startedAt,
        timerEndsAt: gameTimer?.endsAt,
        timerDuration: gameTimer?.duration,
      };

      // Store in database
      await this.databaseService.storeHistoricalGame(storageData);

      this.logger.log(`📊 Game ${gameAddress} stored in PostgreSQL database`);
    } catch (error) {
      this.logger.error(
        `Failed to store game ${gameAddress} in database:`,
        error
      );
      // Don't throw error here to avoid breaking game resolution flow
    }
  }
}
