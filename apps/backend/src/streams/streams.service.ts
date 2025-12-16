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
    detectionEnabled?: boolean;
    type?: string;
    splitLayout?: string;
  }): Promise<Stream> {
    const createData: Prisma.StreamCreateInput = {
      name: data.name,
      rtspUrl: data.rtspUrl ?? '',
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
      detectionEnabled?: boolean;
      type?: string;
      splitLayout?: string;
    },
  ): Promise<Stream> {
    try {
      const updateData: Prisma.StreamUpdateInput = {};
      if (data.name) updateData.name = data.name;
      if (data.rtspUrl) updateData.rtspUrl = data.rtspUrl;
      if (data.detectionEnabled !== undefined) updateData.detectionEnabled = data.detectionEnabled;
      if (data.type) updateData.type = data.type as any;
      if (data.splitLayout) updateData.splitLayout = data.splitLayout as any;

      return await this.prisma.stream.update({
        where: { id },
        data: updateData,
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
          status: 'RUNNING',
          lastHeartbeat: new Date(),
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
          status: 'STOPPED',
        },
      });
    } catch {
      throw new NotFoundException('Stream not found');
    }
  }

  async health(id: string): Promise<Pick<Stream, 'id' | 'status' | 'lastHeartbeat' | 'lastFrameAt' | 'detectionEnabled'>> {
    const stream = await this.findById(id);

    return {
      id: stream.id,
      status: stream.status,
      lastHeartbeat: stream.lastHeartbeat,
      lastFrameAt: stream.lastFrameAt,
      detectionEnabled: stream.detectionEnabled,
    };
  }
}
