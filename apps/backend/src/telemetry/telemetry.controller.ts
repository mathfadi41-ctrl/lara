import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { CreateTelemetryDto } from './dto/create-telemetry.dto';
import { GetTelemetryDto } from './dto/get-telemetry.dto';

@ApiTags('telemetry')
@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('streams/:id/telemetry')
  @ApiOperation({ summary: 'Ingest telemetry sample' })
  async create(
    @Param('id') streamId: string,
    @Body() dto: CreateTelemetryDto,
  ) {
    return this.telemetryService.create(streamId, dto);
  }

  @Get('streams/:id/telemetry')
  @ApiOperation({ summary: 'Get telemetry history' })
  async getHistory(
    @Param('id') streamId: string,
    @Query() dto: GetTelemetryDto,
  ) {
    return this.telemetryService.getHistory(streamId, dto);
  }

  @Get('telemetry/latest')
  @ApiOperation({ summary: 'Get latest telemetry for all streams' })
  async getAllLatest() {
    return this.telemetryService.getAllLatest();
  }
}
