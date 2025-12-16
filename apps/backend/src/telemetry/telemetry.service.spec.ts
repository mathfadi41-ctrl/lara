import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsGateway } from '../websocket/events.gateway';
import { CreateTelemetryDto } from './dto/create-telemetry.dto';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let prisma: PrismaService;
  let redis: RedisService;
  let events: EventsGateway;

  const mockPrisma = {
    telemetry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    stream: {
      findMany: jest.fn(),
    },
  };

  const mockRedisClient = {
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockEvents = {
    emitTelemetry: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: EventsGateway, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    events = module.get<EventsGateway>(EventsGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create telemetry, cache it, and emit event', async () => {
      const dto: CreateTelemetryDto = {
        latitude: 10,
        longitude: 20,
        altitude: 100,
        heading: 0,
        speed: 10,
        roll: 0,
        pitch: 0,
        yaw: 0,
        source: undefined,
      };

      const result = { id: '1', streamId: 'stream1', ...dto, createdAt: new Date() };
      (mockPrisma.telemetry.create as jest.Mock).mockResolvedValue(result);

      await service.create('stream1', dto);

      expect(prisma.telemetry.create).toHaveBeenCalledWith({
        data: { streamId: 'stream1', ...dto },
      });
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(events.emitTelemetry).toHaveBeenCalledWith(expect.objectContaining({
        streamId: 'stream1',
        latitude: 10,
      }));
    });
  });

  describe('getLatest', () => {
    it('should return cached value if available', async () => {
      const cached = { id: '1', latitude: 50 };
      (mockRedisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cached));

      const result = await service.getLatest('stream1');
      expect(result).toEqual(cached);
      expect(prisma.telemetry.findFirst).not.toHaveBeenCalled();
    });

    it('should query db if cache miss', async () => {
      (mockRedisClient.get as jest.Mock).mockResolvedValue(null);
      const dbResult = { id: '2', latitude: 60 };
      (mockPrisma.telemetry.findFirst as jest.Mock).mockResolvedValue(dbResult);

      const result = await service.getLatest('stream1');
      expect(result).toEqual(dbResult);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });
});
