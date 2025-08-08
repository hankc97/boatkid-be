import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { DatabaseService } from "../../kysely/database.service";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [RedisModule],
  controllers: [AdminController],
  providers: [AdminService, DatabaseService],
  exports: [AdminService, DatabaseService],
})
export class AdminModule {}
