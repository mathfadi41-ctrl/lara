import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

export interface StreamStatusEvent {
  streamId: string;
  status: string;
  timestamp: Date;
}

export interface DetectionEvent {
  streamId: string;
  detectionId: string;
  label: string;
  detectionType?: string;
  confidence: number;
  boundingBox: Record<string, unknown>;
  frameTimestamp: Date;
  latencyMs: number;
  channel?: string;
  streamType?: string;
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

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe:stream")
  async handleSubscribeStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ): Promise<void> {
    const room = `stream:${data.streamId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to ${room}`);
  }

  @SubscribeMessage("unsubscribe:stream")
  async handleUnsubscribeStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ): Promise<void> {
    const room = `stream:${data.streamId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} unsubscribed from ${room}`);
  }

  @SubscribeMessage("detection:enable")
  async handleEnableDetection(
    @MessageBody() data: { streamId: string },
  ): Promise<void> {
    await this.prisma.stream.update({
      where: { id: data.streamId },
      data: { detectionEnabled: true },
    });
    this.server.to(`stream:${data.streamId}`).emit("detection:enabled", {
      streamId: data.streamId,
      timestamp: new Date(),
    });
    this.logger.log(`Detection enabled for stream ${data.streamId}`);
  }

  @SubscribeMessage("detection:disable")
  async handleDisableDetection(
    @MessageBody() data: { streamId: string },
  ): Promise<void> {
    await this.prisma.stream.update({
      where: { id: data.streamId },
      data: { detectionEnabled: false },
    });
    this.server.to(`stream:${data.streamId}`).emit("detection:disabled", {
      streamId: data.streamId,
      timestamp: new Date(),
    });
    this.logger.log(`Detection disabled for stream ${data.streamId}`);
  }

  emitStreamStatus(event: StreamStatusEvent) {
    this.server.emit("stream:status", event);
  }

  emitDetection(event: DetectionEvent, streamId: string) {
    this.server.to(`stream:${streamId}`).emit("detection", event);
  }

  emitHeartbeat(streamId: string) {
    this.server.emit("stream:heartbeat", { streamId, timestamp: new Date() });
  }
}
