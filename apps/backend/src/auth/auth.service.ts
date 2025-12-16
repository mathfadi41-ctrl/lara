import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';

import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthTokens, JwtRefreshPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthResponseDto> {
    const refreshSecret = this.config.get('JWT_REFRESH_SECRET', { infer: true });

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        dto.refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) throw new UnauthorizedException('Invalid refresh token');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.revokedAt) throw new UnauthorizedException('Invalid refresh token');
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.tokenHash !== this.hashRefreshToken(dto.refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshSecret = this.config.get('JWT_REFRESH_SECRET', { infer: true });

    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );

      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Ignore invalid tokens during logout
    }
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const tokens = await this.createTokens(user);

    return {
      ...tokens,
      user: this.usersService.toPublic(user),
    };
  }

  private async createTokens(user: User): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
        jwtid: refreshId,
      },
    );

    const decoded = this.jwtService.decode(refreshToken) as
      | { exp?: number }
      | null;

    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await this.prisma.refreshToken.create({
      data: {
        id: refreshId,
        tokenHash: this.hashRefreshToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
