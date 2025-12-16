import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { QueueModule } from "./queue/queue.module";
import { StreamModule } from "./stream/stream.module";
import { DetectionModule } from "./detection/detection.module";
import { WebSocketModule } from "./websocket/websocket.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TelemetryModule } from "./telemetry/telemetry.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    QueueModule,
    StreamModule,
    DetectionModule,
    WebSocketModule,
    IngestionModule,
    AuthModule,
    UsersModule,
    TelemetryModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
