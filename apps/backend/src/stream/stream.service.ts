import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../database/prisma.service";
import { CreateStreamDto } from "./dto/create-stream.dto";
import { UpdateStreamDto } from "./dto/update-stream.dto";
import { StreamJobData } from "./stream.worker";

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue("stream-processing") private streamQueue: Queue<StreamJobData>,
  ) {}

  async create(createStreamDto: CreateStreamDto) {
    const stream = await this.prisma.stream.create({
      data: {
        name: createStreamDto.name,
        rtspUrl: createStreamDto.rtspUrl,
        detectionEnabled: createStreamDto.detectionEnabled ?? true,
        fps: createStreamDto.fps ?? 5,
        status: "STOPPED",
        type: createStreamDto.type,
        splitLayout: createStreamDto.splitLayout,
      },
    });

    this.logger.log(`Created stream ${stream.id}: ${stream.name}`);
    return stream;
  }

  async findAll() {
    return this.prisma.stream.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id },
      include: {
        detections: {
          take: 10,
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!stream) {
      throw new NotFoundException(`Stream ${id} not found`);
    }

    return stream;
  }

  async update(id: string, updateStreamDto: UpdateStreamDto) {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    
    if (!stream) {
      throw new NotFoundException(`Stream ${id} not found`);
    }

    const wasRunning = stream.status === "RUNNING";
    const needsRestart = wasRunning && (
      updateStreamDto.rtspUrl !== undefined ||
      updateStreamDto.fps !== undefined
    );

    if (needsRestart) {
      await this.stop(id);
    }

    const updated = await this.prisma.stream.update({
      where: { id },
      data: updateStreamDto,
    });

    if (needsRestart) {
      await this.start(id);
    }

    this.logger.log(`Updated stream ${id}`);
    return updated;
  }

  async remove(id: string) {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    
    if (!stream) {
      throw new NotFoundException(`Stream ${id} not found`);
    }

    if (stream.status === "RUNNING") {
      await this.stop(id);
    }

    await this.prisma.stream.delete({ where: { id } });
    this.logger.log(`Deleted stream ${id}`);
    
    return { message: "Stream deleted successfully" };
  }

  async start(id: string) {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    
    if (!stream) {
      throw new NotFoundException(`Stream ${id} not found`);
    }

    if (stream.status === "RUNNING") {
      return { message: "Stream is already running" };
    }

    await this.streamQueue.add(
      "process-stream",
      { streamId: id, action: "start" },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued start job for stream ${id}`);
    return { message: "Stream start initiated" };
  }

  async stop(id: string) {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    
    if (!stream) {
      throw new NotFoundException(`Stream ${id} not found`);
    }

    if (stream.status === "STOPPED") {
      return { message: "Stream is already stopped" };
    }

    await this.streamQueue.add(
      "process-stream",
      { streamId: id, action: "stop" },
      { attempts: 1 },
    );

    this.logger.log(`Queued stop job for stream ${id}`);
    return { message: "Stream stop initiated" };
  }

  async getHealth() {
    const streams = await this.prisma.stream.findMany({
      where: { status: "RUNNING" },
    });

    const now = new Date();
    const unhealthyStreams = streams.filter((stream) => {
      if (!stream.lastHeartbeat) return true;
      const diff = now.getTime() - stream.lastHeartbeat.getTime();
      return diff > 30000;
    });

    return {
      totalStreams: streams.length,
      healthyStreams: streams.length - unhealthyStreams.length,
      unhealthyStreams: unhealthyStreams.map((s) => s.id),
    };
  }

  async getStreamHealth(id: string) {
    const stream = await this.findOne(id);

    return {
      id: stream.id,
      name: stream.name,
      status: stream.status,
      detectionEnabled: stream.detectionEnabled,
      fps: stream.fps,
      lastHeartbeat: stream.lastHeartbeat,
      lastFrameAt: stream.lastFrameAt,
      avgLatencyMs: stream.avgLatencyMs,
    };
  }
}
