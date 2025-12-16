import { Test, TestingModule } from '@nestjs/testing';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { TelemetryService } from './telemetry.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('TelemetrySimulatorService', () => {
  let service: TelemetrySimulatorService;
  let telemetryService: TelemetryService;
  let prisma: PrismaService;

  const mockTelemetryService = {
    create: jest.fn(),
  };

  const mockPrisma = {
    stream: {
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'ENABLE_FAKE_TELEMETRY') return 'true';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetrySimulatorService,
        { provide: TelemetryService, useValue: mockTelemetryService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TelemetrySimulatorService>(TelemetrySimulatorService);
    telemetryService = module.get<TelemetryService>(TelemetryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should simulate step', async () => {
    (mockPrisma.stream.findMany as jest.Mock).mockResolvedValue([
      { id: 'stream1', status: 'RUNNING' },
    ]);

    await (service as any).simulateStep();

    expect(telemetryService.create).toHaveBeenCalledWith('stream1', expect.objectContaining({
        latitude: expect.any(Number),
    }));
  });
});
