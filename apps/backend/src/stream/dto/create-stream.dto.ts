import { IsString, IsUrl, IsBoolean, IsInt, Min, Max, IsOptional, IsEnum } from "class-validator";
import { StreamType, SplitLayout } from "@prisma/client";

export class CreateStreamDto {
  @IsString()
  name!: string;

  @IsString()
  rtspUrl!: string;

  @IsBoolean()
  @IsOptional()
  detectionEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  fps?: number;

  @IsEnum(StreamType)
  @IsOptional()
  type?: StreamType;

  @IsEnum(SplitLayout)
  @IsOptional()
  splitLayout?: SplitLayout;
}
