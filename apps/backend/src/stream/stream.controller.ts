import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ValidationPipe,
  UseGuards,
} from "@nestjs/common";
import { StreamService } from "./stream.service";
import { CreateStreamDto } from "./dto/create-stream.dto";
import { UpdateStreamDto } from "./dto/update-stream.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("streams")
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Post()
  create(@Body(new ValidationPipe()) createStreamDto: CreateStreamDto) {
    return this.streamService.create(createStreamDto);
  }

  @Get()
  findAll() {
    return this.streamService.findAll();
  }

  @Get("health")
  getHealth() {
    return this.streamService.getHealth();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.streamService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ValidationPipe()) updateStreamDto: UpdateStreamDto,
  ) {
    return this.streamService.update(id, updateStreamDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.streamService.remove(id);
  }

  @Post(":id/start")
  start(@Param("id") id: string) {
    return this.streamService.start(id);
  }

  @Post(":id/stop")
  stop(@Param("id") id: string) {
    return this.streamService.stop(id);
  }
}
