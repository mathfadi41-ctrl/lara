import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsGateway } from '../websocket/events.gateway';
import { CreateTelemetryDto } from './dto/create-telemetry.dto';
import { GetTelemetryDto } from './dto/get-telemetry.dto';

@Injectable()
export class TelemetryService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(streamId: string, dto: CreateTelemetryDto) {
    const telemetry = await this.prisma.telemetry.create({
      data: {
        streamId,
        ...dto,
      },
    });

    // Cache latest
    await this.redis.getClient().set(`telemetry:latest:${streamId}`, JSON.stringify(telemetry));

    // Broadcast
    this.eventsGateway.emitTelemetry({
      ...telemetry,
      timestamp: telemetry.createdAt,
      source: telemetry.source,
    });

    return telemetry;
  }

  async getHistory(streamId: string, dto: GetTelemetryDto) {
    const { limit = 100, since } = dto;
    return this.prisma.telemetry.findMany({
      where: {
        streamId,
        createdAt: since ? { gt: new Date(since) } : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  async getLatest(streamId: string) {
    // Try cache first
    const cached = await this.redis.getClient().get(`telemetry:latest:${streamId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const latest = await this.prisma.telemetry.findFirst({
      where: { streamId },
      orderBy: { createdAt: 'desc' },
    });
    
    if (latest) {
       await this.redis.getClient().set(`telemetry:latest:${streamId}`, JSON.stringify(latest));
    }
    
    return latest;
  }
  
  async getAllLatest() {
     const streams = await this.prisma.stream.findMany({
       select: {
         id: true,
         telemetry: {
           orderBy: { createdAt: 'desc' },
           take: 1
         }
       }
     });
     
     return streams.map((s: any) => s.telemetry[0]).filter(Boolean);
  }
}
