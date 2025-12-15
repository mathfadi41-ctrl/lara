import { IsString, IsUrl, IsBoolean, IsInt, Min, Max, IsOptional } from "class-validator";

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
}
