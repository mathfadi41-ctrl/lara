import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScreenshotMetadataDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  screenshotKey!: string | null;

  @ApiProperty()
  frameReference!: string;

  @ApiProperty()
  createdAt!: Date;
}
