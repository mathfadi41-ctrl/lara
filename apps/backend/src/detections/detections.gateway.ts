import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

import type { DetectionDto } from './dto/detection.dto';

@WebSocketGateway({ namespace: '/detections', cors: true })
export class DetectionsGateway {
  @WebSocketServer()
  server!: Server;

  emitDetectionCreated(detection: DetectionDto): void {
    this.server.emit('detection.created', detection);
  }
}
