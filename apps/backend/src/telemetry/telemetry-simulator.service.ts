import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelemetryService } from './telemetry.service';
import { PrismaService } from '../database/prisma.service';
import { TelemetrySource, StreamStatus } from '@prisma/client';

interface StreamState {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  roll: number;
  pitch: number;
  yaw: number;
}

@Injectable()
export class TelemetrySimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetrySimulatorService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private streamStates = new Map<string, StreamState>();
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    private telemetryService: TelemetryService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.isEnabled = this.configService.get<string>('ENABLE_FAKE_TELEMETRY') === 'true';
    if (this.isEnabled) {
      this.logger.log('Starting Telemetry Simulator');
      this.startSimulation();
    }
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startSimulation() {
    this.intervalId = setInterval(async () => {
      await this.simulateStep();
    }, 1000); // 1Hz
  }

  private async simulateStep() {
    try {
        const streams = await this.prisma.stream.findMany({
            where: { status: StreamStatus.RUNNING }
        });

        for (const stream of streams) {
            let state = this.streamStates.get(stream.id);
            if (!state) {
                // Initialize state near a default location (San Francisco)
                state = {
                    latitude: 37.7749, 
                    longitude: -122.4194,
                    altitude: 100,
                    heading: 0,
                    speed: 15, // m/s
                    roll: 0,
                    pitch: 0,
                    yaw: 0,
                };
                this.streamStates.set(stream.id, state);
            }

            // Update state (fly in a circle)
            state.heading = (state.heading + 2) % 360;
            
            // Simple lat/lon update based on heading and speed
            const rad = (90 - state.heading) * Math.PI / 180; // Map heading (0=North) to math angle (0=East)
            // Actually, usually Heading 0 is North. Math 0 is East.
            // So North (0) -> Math 90. East (90) -> Math 0.
            // Angle = 90 - Heading.
            
            const distDeg = (state.speed * 1) / 111111; // speed m/s * 1s / meters_per_degree (approx)
            
            state.latitude += distDeg * Math.sin(rad);
            state.longitude += distDeg * Math.cos(rad) / Math.cos(state.latitude * Math.PI / 180);

            await this.telemetryService.create(stream.id, {
                ...state,
                source: TelemetrySource.SIMULATOR,
            });
        }
    } catch (error) {
        this.logger.error('Error in simulation step', error);
    }
  }
}
