import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Detection } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DetectionDto } from './dto/detection.dto';
import { ListDetectionsQueryDto } from './dto/list-detections-query.dto';
import { ScreenshotMetadataDto } from './dto/screenshot-metadata.dto';
import { DetectionsService } from './detections.service';

function toDto(d: Detection): DetectionDto {
  return {
    id: d.id,
    streamId: d.streamId,
    type: d.type,
    confidence: d.confidence,
    boundingBoxes: d.boundingBoxes,
    frameReference: d.frameReference,
    screenshotKey: d.screenshotKey,
    createdAt: d.createdAt,
  };
}

@ApiTags('detections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('detections')
export class DetectionsController {
  constructor(private readonly detectionsService: DetectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List detection history' })
  async list(@Query() query: ListDetectionsQueryDto): Promise<DetectionDto[]> {
    const detections = await this.detectionsService.list({
      streamId: query.streamId,
      take: query.take,
    });
    return detections.map(toDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detection by id' })
  async get(@Param('id') id: string): Promise<DetectionDto> {
    const detection = await this.detectionsService.findById(id);
    return toDto(detection);
  }

  @Get(':id/screenshot-metadata')
  @ApiOperation({ summary: 'Get screenshot metadata for a detection' })
  async screenshotMetadata(
    @Param('id') id: string,
  ): Promise<ScreenshotMetadataDto> {
    return this.detectionsService.screenshotMetadata(id);
  }
}
