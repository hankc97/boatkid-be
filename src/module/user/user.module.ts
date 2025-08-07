import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { GameTimerService } from "./game-timer.service";
import { RedisModule } from "../redis/redis.module";
import { PusherModule } from "../pusher/pusher.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [RedisModule, PusherModule, AdminModule],
  controllers: [UserController],
  providers: [UserService, GameTimerService],
  exports: [UserService, GameTimerService],
})
export class UserModule {}
