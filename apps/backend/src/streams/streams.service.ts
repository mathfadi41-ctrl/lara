import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Stream } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Stream[]> {
    return this.prisma.stream.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Stream> {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) throw new NotFoundException('Stream not found');
    return stream;
  }

  async create(data: {
    name: string;
    rtspUrl?: string;
    webrtcUrl?: string;
    detectionEnabled?: boolean;
    type?: string;
    splitLayout?: string;
  }): Promise<Stream> {
    const createData: Prisma.StreamCreateInput = {
      name: data.name,
      rtspUrl: data.rtspUrl,
      webrtcUrl: data.webrtcUrl,
      detectionEnabled: data.detectionEnabled ?? false,
      type: data.type as any,
      splitLayout: data.splitLayout as any,
    };

    return this.prisma.stream.create({ data: createData });
  }

  async update(
    id: string,
    data: {
      name?: string;
      rtspUrl?: string;
      webrtcUrl?: string;
      detectionEnabled?: boolean;
      type?: string;
      splitLayout?: string;
    },
  ): Promise<Stream> {
    try {
      return await this.prisma.stream.update({
        where: { id },
        data: {
          name: data.name,
          rtspUrl: data.rtspUrl,
          webrtcUrl: data.webrtcUrl,
          detectionEnabled: data.detectionEnabled,
          type: data.type as any,
          splitLayout: data.splitLayout as any,
        },
      });
    } catch {
      throw new NotFoundException('Stream not found');
    }
  }

  async start(id: string): Promise<Stream> {
    try {
      return await this.prisma.stream.update({
        where: { id },
        data: {
          isRunning: true,
          isOnline: true,
          lastHealthCheckAt: new Date(),
          lastError: null,
        },
      });
    } catch {
      throw new NotFoundException('Stream not found');
    }
  }

  async stop(id: string): Promise<Stream> {
    try {
      return await this.prisma.stream.update({
        where: { id },
        data: {
          isRunning: false,
          lastHealthCheckAt: new Date(),
        },
      });
    } catch {
      throw new NotFoundException('Stream not found');
    }
  }

  async health(id: string): Promise<Pick<Stream, 'id' | 'isRunning' | 'isOnline' | 'lastHealthCheckAt' | 'lastFrameAt' | 'lastError' | 'detectionEnabled'>> {
    const stream = await this.findById(id);

    return {
      id: stream.id,
      isRunning: stream.isRunning,
      isOnline: stream.isOnline,
      lastHealthCheckAt: stream.lastHealthCheckAt,
      lastFrameAt: stream.lastFrameAt,
      lastError: stream.lastError,
      detectionEnabled: stream.detectionEnabled,
    };
  }
}
