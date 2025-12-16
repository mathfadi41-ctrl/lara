import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DatabaseModule, RedisModule, WebSocketModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetrySimulatorService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
