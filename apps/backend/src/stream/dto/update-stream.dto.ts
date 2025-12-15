import { IsString, IsBoolean, IsInt, Min, Max, IsOptional } from "class-validator";

export class UpdateStreamDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  rtspUrl?: string;

  @IsBoolean()
  @IsOptional()
  detectionEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  fps?: number;
}
