import { Module } from "@nestjs/common";
import { DetectionService } from "./detection.service";
import { DetectionController } from "./detection.controller";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [WebSocketModule],
  providers: [DetectionService],
  controllers: [DetectionController],
  exports: [DetectionService],
})
export class DetectionModule {}
