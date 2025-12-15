import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
