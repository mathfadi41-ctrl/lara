import { Test, TestingModule } from "@nestjs/testing";
import { StreamService } from "../src/stream/stream.service";
import { DetectionService } from "../src/detection/detection.service";
import { IngestionService } from "../src/ingestion/ingestion.service";
import { PrismaService } from "../src/database/prisma.service";

describe("Stream Pipeline Integration", () => {
  let streamService: StreamService;
  let detectionService: DetectionService;
  let ingestionService: IngestionService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamService,
        DetectionService,
        IngestionService,
        PrismaService,
        {
          provide: "BullQueue_stream-processing",
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: "ConfigService",
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                AI_SERVICE_URL: "http://localhost:8000",
                FRAME_STORAGE_PATH: "/tmp/test-frames",
                FFMPEG_PATH: "/usr/bin/ffmpeg",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    streamService = module.get<StreamService>(StreamService);
    detectionService = module.get<DetectionService>(DetectionService);
    ingestionService = module.get<IngestionService>(IngestionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Stream Creation", () => {
    it("should create a stream with default values", async () => {
      const createDto = {
        name: "Test Stream",
        rtspUrl: "rtsp://example.com/stream",
      };

      const stream = await streamService.create(createDto);

      expect(stream).toBeDefined();
      expect(stream.name).toBe(createDto.name);
      expect(stream.rtspUrl).toBe(createDto.rtspUrl);
      expect(stream.status).toBe("STOPPED");
      expect(stream.detectionEnabled).toBe(true);
      expect(stream.fps).toBe(5);
      expect(stream.type).toBe("COLOR");
      expect(stream.splitLayout).toBeNull();
    });

    it("should create a stream with custom fps", async () => {
      const createDto = {
        name: "High FPS Stream",
        rtspUrl: "rtsp://example.com/stream2",
        fps: 15,
        detectionEnabled: false,
      };

      const stream = await streamService.create(createDto);

      expect(stream.fps).toBe(15);
      expect(stream.detectionEnabled).toBe(false);
    });

    it("should create a THERMAL stream", async () => {
      const createDto = {
        name: "Thermal Camera",
        rtspUrl: "rtsp://example.com/thermal",
        type: "THERMAL",
      };

      const stream = await streamService.create(createDto);

      expect(stream.type).toBe("THERMAL");
    });

    it("should create a SPLIT stream with layout", async () => {
      const createDto = {
        name: "Split View Camera",
        rtspUrl: "rtsp://example.com/split",
        type: "SPLIT",
        splitLayout: "LEFT_RIGHT",
      };

      const stream = await streamService.create(createDto);

      expect(stream.type).toBe("SPLIT");
      expect(stream.splitLayout).toBe("LEFT_RIGHT");
    });
  });

  describe("Stream Control", () => {
    it("should queue start job for a stream", async () => {
      const stream = await streamService.create({
        name: "Control Test Stream",
        rtspUrl: "rtsp://example.com/control",
      });

      const result = await streamService.start(stream.id);

      expect(result.message).toContain("initiated");
    });

    it("should queue stop job for a stream", async () => {
      const stream = await streamService.create({
        name: "Stop Test Stream",
        rtspUrl: "rtsp://example.com/stop",
      });

      const result = await streamService.stop(stream.id);

      expect(result.message).toContain("initiated");
    });
  });

  describe("Detection Processing", () => {
    it("should skip frame processing when detection is disabled", async () => {
      const stream = await streamService.create({
        name: "No Detection Stream",
        rtspUrl: "rtsp://example.com/nodetect",
        detectionEnabled: false,
      });

      const mockFrame = {
        buffer: Buffer.from("mock-frame-data"),
        timestamp: new Date(),
        streamId: stream.id,
      };

      await expect(detectionService.processFrame(mockFrame)).resolves.not.toThrow();
    });
  });

  describe("Health Check", () => {
    it("should return stream health status", async () => {
      const health = await streamService.getHealth();

      expect(health).toBeDefined();
      expect(health.totalStreams).toBeGreaterThanOrEqual(0);
      expect(health.healthyStreams).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(health.unhealthyStreams)).toBe(true);
    });
  });
});
