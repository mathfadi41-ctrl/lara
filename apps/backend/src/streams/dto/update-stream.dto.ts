import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { StreamType, SplitLayout } from '@prisma/client';

export class UpdateStreamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rtspUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  detectionEnabled?: boolean;

  @ApiPropertyOptional({ enum: StreamType })
  @IsOptional()
  @IsEnum(StreamType)
  type?: StreamType;

  @ApiPropertyOptional({ enum: SplitLayout })
  @IsOptional()
  @IsEnum(SplitLayout)
  splitLayout?: SplitLayout;
}
