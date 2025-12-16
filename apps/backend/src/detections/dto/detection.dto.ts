import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DetectionType } from '@prisma/client';

export class DetectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  streamId!: string;

  @ApiProperty({ enum: ['SMOKE', 'FIRE', 'HOTSPOT'] })
  detectionType!: DetectionType;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  confidence!: number;

  @ApiProperty({ description: 'Bounding box describing detection location', type: 'object' })
  boundingBox!: unknown;

  @ApiPropertyOptional()
  frameReference!: string | null;

  @ApiPropertyOptional()
  screenshotKey!: string | null;

  @ApiProperty()
  timestamp!: Date;

  @ApiProperty()
  createdAt!: Date;
}
