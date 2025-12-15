import { Module } from "@nestjs/common";
import { DetectionService } from "./detection.service";
import { DetectionController } from "./detection.controller";

@Module({
  providers: [DetectionService],
  controllers: [DetectionController],
  exports: [DetectionService],
})
export class DetectionModule {}
