import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScreenshotMetadataDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  screenshotKey!: string | null;

  @ApiPropertyOptional()
  frameReference!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
