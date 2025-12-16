import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StreamType, SplitLayout } from '@prisma/client';

export class StreamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  rtspUrl!: string | null;

  @ApiPropertyOptional()
  webrtcUrl!: string | null;

  @ApiProperty()
  detectionEnabled!: boolean;

  @ApiProperty({ enum: StreamType })
  type!: StreamType;

  @ApiPropertyOptional({ enum: SplitLayout })
  splitLayout!: SplitLayout | null;

  @ApiProperty()
  isRunning!: boolean;

  @ApiProperty()
  isOnline!: boolean;

  @ApiPropertyOptional()
  lastHealthCheckAt!: Date | null;

  @ApiPropertyOptional()
  lastFrameAt!: Date | null;

  @ApiPropertyOptional()
  lastError!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
