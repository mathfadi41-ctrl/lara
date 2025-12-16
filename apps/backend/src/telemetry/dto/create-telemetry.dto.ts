import { IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { TelemetrySource } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTelemetryDto {
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty()
  @IsNumber()
  altitude: number;

  @ApiProperty()
  @IsNumber()
  heading: number;

  @ApiProperty()
  @IsNumber()
  speed: number;

  @ApiProperty()
  @IsNumber()
  roll: number;

  @ApiProperty()
  @IsNumber()
  pitch: number;

  @ApiProperty()
  @IsNumber()
  yaw: number;

  @ApiProperty({ enum: TelemetrySource, required: false })
  @IsEnum(TelemetrySource)
  @IsOptional()
  source?: TelemetrySource;
}
