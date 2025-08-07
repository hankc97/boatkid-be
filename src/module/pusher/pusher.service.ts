import { Injectable, Logger } from "@nestjs/common";
import Pusher from "pusher";

@Injectable()
export class PusherService {
  private pusher: any;
  private readonly logger = new Logger(PusherService.name);
  private readonly GAME_CHANNEL = "boatkid-game";

  constructor() {
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    });
  }

  async broadcastGameUpdate(event: string, data: any): Promise<void> {
    try {
      await this.pusher.trigger(this.GAME_CHANNEL, event, data);
      this.logger.debug(`Broadcasted ${event} to ${this.GAME_CHANNEL}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast ${event}:`, error);
    }
  }

  // Broadcast to specific game channel (for multiple concurrent games)
  async broadcastToGameChannel(
    gameAddress: string,
    event: string,
    data: any
  ): Promise<void> {
    try {
      const gameChannel = `game-${gameAddress}`;
      await this.pusher.trigger(gameChannel, event, data);
      this.logger.debug(`Broadcasted ${event} to ${gameChannel}`);
    } catch (error) {
      this.logger.error(
        `Failed to broadcast ${event} to game ${gameAddress}:`,
        error
      );
    }
  }

  // Get channel info (optional - for monitoring)
  async getChannelInfo(): Promise<any> {
    try {
      return await this.pusher.get({
        path: `/channels/${this.GAME_CHANNEL}`,
      });
    } catch (error) {
      this.logger.error("Failed to get channel info:", error);
      return null;
    }
  }
}
