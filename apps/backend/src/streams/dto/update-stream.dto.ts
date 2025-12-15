import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
  @IsString()
  webrtcUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  detectionEnabled?: boolean;
}
