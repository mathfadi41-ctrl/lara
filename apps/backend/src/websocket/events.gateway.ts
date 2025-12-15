import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

export interface StreamStatusEvent {
  streamId: string;
  status: string;
  timestamp: Date;
}

export interface DetectionEvent {
  streamId: string;
  detectionId: string;
  label: string;
  confidence: number;
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitStreamStatus(event: StreamStatusEvent) {
    this.server.emit("stream:status", event);
  }

  emitDetection(event: DetectionEvent) {
    this.server.emit("detection", event);
  }

  emitHeartbeat(streamId: string) {
    this.server.emit("stream:heartbeat", { streamId, timestamp: new Date() });
  }
}
