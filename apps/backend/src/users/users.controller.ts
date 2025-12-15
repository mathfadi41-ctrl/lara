import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserRoleDto } from './dto/set-user-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    const found = await this.usersService.findById(user.userId);
    if (!found) throw new NotFoundException('User not found');

    return this.usersService.toPublic(found);
  }

  @Get()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'List users (Admin)' })
  async list(): Promise<UserDto[]> {
    const users = await this.usersService.list();
    return users.map((u) => this.usersService.toPublic(u));
  }

  @Get(':id')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Get user by id (Admin)' })
  async get(@Param('id') id: string): Promise<UserDto> {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.usersService.toPublic(user);
  }

  @Post()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Create user (Admin)' })
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    const user = await this.usersService.create(dto);
    return this.usersService.toPublic(user);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Update user (Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    const user = await this.usersService.update(id, dto);
    return this.usersService.toPublic(user);
  }

  @Patch(':id/role')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Set user role (Admin)' })
  async setRole(
    @Param('id') id: string,
    @Body() dto: SetUserRoleDto,
  ): Promise<UserDto> {
    const user = await this.usersService.setRole(id, dto.role);
    return this.usersService.toPublic(user);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Delete user (Admin)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
