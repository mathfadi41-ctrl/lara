import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs/promises";
import * as path from "path";
import { Stream } from "@prisma/client";

export interface FrameData {
  buffer: Buffer;
  timestamp: Date;
  streamId: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private activeProcesses = new Map<string, ffmpeg.FfmpegCommand>();
  private frameCallbacks = new Map<string, (frame: FrameData) => void>();

  constructor(private configService: ConfigService) {
    const ffmpegPath = this.configService.get<string>("FFMPEG_PATH");
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }

  async startStream(stream: Stream, onFrame: (frame: FrameData) => void): Promise<void> {
    if (this.activeProcesses.has(stream.id)) {
      this.logger.warn(`Stream ${stream.id} is already running`);
      return;
    }

    this.frameCallbacks.set(stream.id, onFrame);

    const tempDir = path.join("/tmp", `stream-${stream.id}`);
    await fs.mkdir(tempDir, { recursive: true });

    const fps = stream.fps || 5;
    const frameInterval = 1000 / fps;
    let lastFrameTime = 0;
    let frameCounter = 0;

    const command = ffmpeg(stream.rtspUrl)
      .inputOptions([
        "-rtsp_transport tcp",
        "-fflags nobuffer",
        "-flags low_delay",
        "-analyzeduration 1000000",
        "-probesize 1000000",
        "-rtbufsize 0",
        "-use_wallclock_as_timestamps 1",
      ])
      .outputOptions([
        "-vf", `fps=${fps}`,
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
      ])
      .on("start", (commandLine: string) => {
        this.logger.log(`Started FFmpeg for stream ${stream.id}: ${commandLine}`);
      })
      .on("error", (err: any) => {
        this.logger.error(`FFmpeg error for stream ${stream.id}: ${err.message || err}`);
        this.stopStream(stream.id);
      })
      .on("end", () => {
        this.logger.log(`FFmpeg ended for stream ${stream.id}`);
        this.stopStream(stream.id);
      });

    let buffer = Buffer.alloc(0);
    const SOI = Buffer.from([0xff, 0xd8]);
    const EOI = Buffer.from([0xff, 0xd9]);

    command.pipe().on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      let startIdx = 0;
      while (true) {
        const soiIdx = buffer.indexOf(SOI, startIdx);
        if (soiIdx === -1) break;

        const eoiIdx = buffer.indexOf(EOI, soiIdx + 2);
        if (eoiIdx === -1) break;

        const now = Date.now();
        if (now - lastFrameTime >= frameInterval) {
          const frameBuffer = buffer.slice(soiIdx, eoiIdx + 2);
          const callback = this.frameCallbacks.get(stream.id);
          if (callback) {
            callback({
              buffer: frameBuffer,
              timestamp: new Date(),
              streamId: stream.id,
            });
          }
          lastFrameTime = now;
          frameCounter++;
        }

        startIdx = eoiIdx + 2;
      }

      buffer = buffer.slice(startIdx);
    });

    this.activeProcesses.set(stream.id, command);
  }

  async stopStream(streamId: string): Promise<void> {
    const command = this.activeProcesses.get(streamId);
    if (command) {
      command.kill("SIGKILL");
      this.activeProcesses.delete(streamId);
      this.frameCallbacks.delete(streamId);
      this.logger.log(`Stopped stream ${streamId}`);
    }

    const tempDir = path.join("/tmp", `stream-${streamId}`);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(`Failed to clean up temp directory for stream ${streamId}`);
    }
  }

  isStreamActive(streamId: string): boolean {
    return this.activeProcesses.has(streamId);
  }

  async stopAll(): Promise<void> {
    const streamIds = Array.from(this.activeProcesses.keys());
    await Promise.all(streamIds.map((id) => this.stopStream(id)));
  }
}
