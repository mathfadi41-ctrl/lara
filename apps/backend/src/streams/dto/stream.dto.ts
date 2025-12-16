import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StreamType, SplitLayout, StreamStatus } from '@prisma/client';

export class StreamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  rtspUrl!: string;

  @ApiProperty()
  detectionEnabled!: boolean;

  @ApiProperty()
  fps!: number;

  @ApiProperty({ enum: StreamStatus })
  status!: StreamStatus;

  @ApiProperty({ enum: StreamType })
  type!: StreamType;

  @ApiPropertyOptional({ enum: SplitLayout })
  splitLayout!: SplitLayout | null;

  @ApiPropertyOptional()
  lastHeartbeat!: Date | null;

  @ApiPropertyOptional()
  lastFrameAt!: Date | null;

  @ApiProperty()
  avgLatencyMs!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
