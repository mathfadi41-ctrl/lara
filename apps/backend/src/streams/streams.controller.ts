import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, type Stream } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateStreamDto } from './dto/create-stream.dto';
import { StreamDto } from './dto/stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { StreamsService } from './streams.service';

function toDto(stream: Stream): StreamDto {
  return stream;
}

@ApiTags('streams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Get()
  @ApiOperation({ summary: 'List streams' })
  async list(): Promise<StreamDto[]> {
    const streams = await this.streamsService.list();
    return streams.map(toDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stream by id' })
  async get(@Param('id') id: string): Promise<StreamDto> {
    const stream = await this.streamsService.findById(id);
    return toDto(stream);
  }

  @Post()
  @Roles(Role.Admin, Role.Operator)
  @ApiOperation({ summary: 'Register a stream (Admin/Operator)' })
  async create(@Body() dto: CreateStreamDto): Promise<StreamDto> {
    const stream = await this.streamsService.create(dto);
    return toDto(stream);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Operator)
  @ApiOperation({ summary: 'Update stream (Admin/Operator)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStreamDto,
  ): Promise<StreamDto> {
    const stream = await this.streamsService.update(id, dto);
    return toDto(stream);
  }

  @Post(':id/start')
  @Roles(Role.Admin, Role.Operator)
  @ApiOperation({ summary: 'Start stream (Admin/Operator)' })
  async start(@Param('id') id: string): Promise<StreamDto> {
    const stream = await this.streamsService.start(id);
    return toDto(stream);
  }

  @Post(':id/stop')
  @Roles(Role.Admin, Role.Operator)
  @ApiOperation({ summary: 'Stop stream (Admin/Operator)' })
  async stop(@Param('id') id: string): Promise<StreamDto> {
    const stream = await this.streamsService.stop(id);
    return toDto(stream);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get stream health' })
  async health(
    @Param('id') id: string,
  ): Promise<Awaited<ReturnType<StreamsService['health']>>> {
    return this.streamsService.health(id);
  }
}
