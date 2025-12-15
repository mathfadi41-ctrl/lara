import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { DetectionService } from "./detection.service";
import { Response } from "express";
import * as fs from "fs/promises";

@Controller("detections")
export class DetectionController {
  constructor(private detectionService: DetectionService) {}

  @Get()
  async getRecentDetections(@Query("limit") limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.detectionService.getRecentDetections(limitNum);
  }

  @Get("stream/:streamId")
  async getStreamDetections(
    @Param("streamId") streamId: string,
    @Query("limit") limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.detectionService.getDetectionsByStream(streamId, limitNum);
  }

  @Get("screenshot/:streamId/:filename")
  async getScreenshot(
    @Param("streamId") streamId: string,
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    try {
      const filepath = `./storage/frames/${streamId}/${filename}`;
      const file = await fs.readFile(filepath);
      res.setHeader("Content-Type", "image/jpeg");
      res.send(file);
    } catch (error) {
      res.status(404).json({ error: "Screenshot not found" });
    }
  }
}
