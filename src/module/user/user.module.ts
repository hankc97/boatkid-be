import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { GameTimerService } from "./game-timer.service";
import { RedisModule } from "../redis/redis.module";
import { PusherModule } from "../pusher/pusher.module";
import { AdminModule } from "../admin/admin.module";
import { DatabaseService } from "../../kysely/database.service";

@Module({
  imports: [RedisModule, PusherModule, AdminModule],
  controllers: [UserController],
  providers: [UserService, GameTimerService, DatabaseService],
  exports: [UserService, GameTimerService, DatabaseService],
})
export class UserModule {}
