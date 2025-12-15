import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DetectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  streamId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  confidence!: number;

  @ApiProperty({ description: 'Array/object describing bounding boxes', type: 'object' })
  boundingBoxes!: unknown;

  @ApiProperty()
  frameReference!: string;

  @ApiPropertyOptional()
  screenshotKey!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
