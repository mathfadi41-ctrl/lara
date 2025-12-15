import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../database/prisma.service";
import { IngestionService } from "../ingestion/ingestion.service";
import { DetectionService } from "../detection/detection.service";
import { EventsGateway } from "../websocket/events.gateway";

export interface StreamJobData {
  streamId: string;
  action: "start" | "stop";
}

@Processor("stream-processing", {
  concurrency: 10,
})
export class StreamWorker extends WorkerHost {
  private readonly logger = new Logger(StreamWorker.name);
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private ingestionService: IngestionService,
    private detectionService: DetectionService,
    private eventsGateway: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<StreamJobData>): Promise<void> {
    const { streamId, action } = job.data;
    this.logger.log(`Processing job ${job.id} for stream ${streamId}: ${action}`);

    if (action === "start") {
      await this.startStream(streamId);
    } else if (action === "stop") {
      await this.stopStream(streamId);
    }
  }

  private async startStream(streamId: string): Promise<void> {
    try {
      const stream = await this.prisma.stream.findUnique({
        where: { id: streamId },
      });

      if (!stream) {
        this.logger.error(`Stream ${streamId} not found`);
        return;
      }

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { status: "STARTING" },
      });

      this.eventsGateway.emitStreamStatus({
        streamId,
        status: "STARTING",
        timestamp: new Date(),
      });

      await this.ingestionService.startStream(stream, async (frame) => {
        await this.detectionService.processFrame(frame);
      });

      await this.prisma.stream.update({
        where: { id: streamId },
        data: {
          status: "RUNNING",
          lastHeartbeat: new Date(),
        },
      });

      this.eventsGateway.emitStreamStatus({
        streamId,
        status: "RUNNING",
        timestamp: new Date(),
      });

      const heartbeatInterval = setInterval(async () => {
        try {
          await this.prisma.stream.update({
            where: { id: streamId },
            data: { lastHeartbeat: new Date() },
          });
          this.eventsGateway.emitHeartbeat(streamId);
        } catch (error) {
          this.logger.error(`Failed to update heartbeat for stream ${streamId}`);
        }
      }, 10000);

      this.heartbeatIntervals.set(streamId, heartbeatInterval);

      this.logger.log(`Stream ${streamId} started successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start stream ${streamId}: ${message}`);
      
      await this.prisma.stream.update({
        where: { id: streamId },
        data: { status: "ERROR" },
      });

      this.eventsGateway.emitStreamStatus({
        streamId,
        status: "ERROR",
        timestamp: new Date(),
      });
    }
  }

  private async stopStream(streamId: string): Promise<void> {
    try {
      await this.prisma.stream.update({
        where: { id: streamId },
        data: { status: "STOPPING" },
      });

      this.eventsGateway.emitStreamStatus({
        streamId,
        status: "STOPPING",
        timestamp: new Date(),
      });

      const interval = this.heartbeatIntervals.get(streamId);
      if (interval) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(streamId);
      }

      await this.ingestionService.stopStream(streamId);

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { status: "STOPPED" },
      });

      this.eventsGateway.emitStreamStatus({
        streamId,
        status: "STOPPED",
        timestamp: new Date(),
      });

      this.logger.log(`Stream ${streamId} stopped successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to stop stream ${streamId}: ${message}`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<StreamJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
