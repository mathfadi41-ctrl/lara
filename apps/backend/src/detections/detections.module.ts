import { Module } from '@nestjs/common';

import { DetectionsController } from './detections.controller';
import { DetectionsGateway } from './detections.gateway';
import { DetectionsService } from './detections.service';

@Module({
  controllers: [DetectionsController],
  providers: [DetectionsService, DetectionsGateway],
  exports: [DetectionsService, DetectionsGateway],
})
export class DetectionsModule {}
