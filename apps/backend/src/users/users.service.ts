import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(input: {
    email: string;
    password: string;
    role?: Role;
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          role: input.role ?? Role.Viewer,
          passwordHash,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
      }

      throw err;
    }
  }

  async update(id: string, input: { email?: string; password?: string }): Promise<User> {
    const data: Prisma.UserUpdateInput = {};

    if (input.email) data.email = input.email;
    if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
        if (err.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
      }
      throw err;
    }
  }

  async setRole(id: string, role: Role): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { role },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
      }
      throw err;
    }
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
