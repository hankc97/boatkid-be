import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { UserModule } from "./module/user/user.module";
import { AdminModule } from "./module/admin/admin.module";
import { HistoricalModule } from "./module/historical/historical.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ScheduleModule.forRoot(),
    SchedulerModule,
    UserModule,
    AdminModule,
    HistoricalModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
