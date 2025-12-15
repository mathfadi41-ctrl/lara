import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { StreamService } from "./stream.service";
import { StreamController } from "./stream.controller";
import { StreamWorker } from "./stream.worker";
import { IngestionModule } from "../ingestion/ingestion.module";
import { DetectionModule } from "../detection/detection.module";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "stream-processing",
    }),
    IngestionModule,
    DetectionModule,
    WebSocketModule,
  ],
  controllers: [StreamController],
  providers: [StreamService, StreamWorker],
  exports: [StreamService],
})
export class StreamModule {}
