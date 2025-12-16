import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { StreamType, SplitLayout } from '@prisma/client';

export class CreateStreamDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rtspUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webrtcUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  detectionEnabled?: boolean;

  @ApiPropertyOptional({ enum: StreamType, default: StreamType.COLOR })
  @IsOptional()
  @IsEnum(StreamType)
  type?: StreamType;

  @ApiPropertyOptional({ enum: SplitLayout })
  @IsOptional()
  @IsEnum(SplitLayout)
  splitLayout?: SplitLayout;
}
