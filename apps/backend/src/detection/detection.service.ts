import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { EventsGateway } from "../websocket/events.gateway";
import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { FrameData } from "../ingestion/ingestion.service";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface AIResponse {
  detections: DetectionResult[];
}

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);
  private readonly aiServiceUrl: string;
  private readonly frameStoragePath: string;
  private pendingRequests = new Map<string, number>();
  private latencyBuffer = new Map<string, number[]>();
  private lastMetricsUpdate = new Map<string, number>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {
    this.aiServiceUrl = this.configService.get<string>("AI_SERVICE_URL") || "http://localhost:8000";
    this.frameStoragePath = this.configService.get<string>("FRAME_STORAGE_PATH") || "./storage/frames";
  }

  async processFrame(frame: FrameData): Promise<void> {
    const frameStartTime = Date.now();
    const stream = await this.prisma.stream.findUnique({
      where: { id: frame.streamId },
    });

    if (!stream || !stream.detectionEnabled) {
      return;
    }

    const pending = this.pendingRequests.get(frame.streamId) || 0;
    if (pending > 5) {
      this.logger.warn(`Too many pending requests for stream ${frame.streamId}, skipping frame`);
      return;
    }

    this.pendingRequests.set(frame.streamId, pending + 1);

    try {
      const detections = await this.detectObjects(frame.buffer);
      const latencyMs = Date.now() - frameStartTime;

      // Update latency buffer
      const latencies = this.latencyBuffer.get(frame.streamId) || [];
      latencies.push(latencyMs);
      if (latencies.length > 100) {
        latencies.shift();
      }
      this.latencyBuffer.set(frame.streamId, latencies);

      // Update metrics throttled (every 500ms)
      const now = Date.now();
      const lastUpdate = this.lastMetricsUpdate.get(frame.streamId) || 0;
      if (now - lastUpdate > 500) {
        this.updateStreamMetrics(frame.streamId);
        this.lastMetricsUpdate.set(frame.streamId, now);
      }

      if (detections.length > 0) {
        await this.saveDetections(frame, detections, latencyMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing frame for stream ${frame.streamId}: ${message}`);
    } finally {
      this.pendingRequests.set(frame.streamId, Math.max(0, (this.pendingRequests.get(frame.streamId) || 1) - 1));
    }
  }

  private async updateStreamMetrics(streamId: string): Promise<void> {
    const latencies = this.latencyBuffer.get(streamId) || [];
    if (latencies.length === 0) return;

    const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    await this.prisma.stream.update({
      where: { id: streamId },
      data: {
        lastFrameAt: new Date(),
        avgLatencyMs,
      },
    });
  }

  private async detectObjects(frameBuffer: Buffer): Promise<DetectionResult[]> {
    try {
      const formData = new FormData();
      const blob = new Blob([frameBuffer], { type: "image/jpeg" });
      formData.append("file", blob, "frame.jpg");

      const response = await axios.post<AIResponse>(
        `${this.aiServiceUrl}/detect`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 5000,
        },
      );

      return response.data.detections || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          this.logger.warn("AI service is not available");
        } else {
          this.logger.error(`AI service error: ${error.message}`);
        }
      }
      return [];
    }
  }

  private async saveDetections(
    frame: FrameData,
    detections: DetectionResult[],
    latencyMs: number,
  ): Promise<void> {
    const storageDir = path.join(this.frameStoragePath, frame.streamId);
    await fs.mkdir(storageDir, { recursive: true });

    const timestamp = frame.timestamp.getTime();
    const filename = `${timestamp}.jpg`;
    const filepath = path.join(storageDir, filename);

    await fs.writeFile(filepath, frame.buffer);

    for (const detection of detections) {
      const savedDetection = await this.prisma.detection.create({
        data: {
          streamId: frame.streamId,
          timestamp: frame.timestamp,
          label: detection.label,
          confidence: detection.confidence,
          boundingBox: detection.boundingBox as any,
          imagePath: filepath,
          metadata: {},
        },
      });

      // Emit detection event to subscribed clients
      this.eventsGateway.emitDetection(
        {
          streamId: frame.streamId,
          detectionId: savedDetection.id,
          label: detection.label,
          confidence: detection.confidence,
          boundingBox: detection.boundingBox,
          frameTimestamp: frame.timestamp,
          latencyMs,
        },
        frame.streamId,
      );
    }

    this.logger.log(`Saved ${detections.length} detections for stream ${frame.streamId}`);
  }

  async getDetectionsByStream(streamId: string, limit = 50): Promise<any[]> {
    return this.prisma.detection.findMany({
      where: { streamId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }

  async getRecentDetections(limit = 100): Promise<any[]> {
    return this.prisma.detection.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        stream: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
