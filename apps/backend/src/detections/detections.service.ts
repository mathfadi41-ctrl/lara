import { Injectable, NotFoundException } from '@nestjs/common';
import type { Detection, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DetectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    streamId?: string;
    take?: number;
  }): Promise<Detection[]> {
    const where: Prisma.DetectionWhereInput = {};
    if (params.streamId) where.streamId = params.streamId;

    return this.prisma.detection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.take ?? 50, 200),
    });
  }

  async findById(id: string): Promise<Detection> {
    const detection = await this.prisma.detection.findUnique({ where: { id } });
    if (!detection) throw new NotFoundException('Detection not found');
    return detection;
  }

  async screenshotMetadata(id: string): Promise<Pick<Detection, 'id' | 'screenshotKey' | 'frameReference' | 'createdAt'>> {
    const detection = await this.findById(id);
    return {
      id: detection.id,
      screenshotKey: detection.screenshotKey,
      frameReference: detection.frameReference,
      createdAt: detection.createdAt,
    };
  }
}
