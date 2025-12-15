import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const usersService = {
    findByEmail: jest.fn<Promise<User | null>, [string]>(),
    create: jest.fn<Promise<User>, [{ email: string; password: string }]>(),
    toPublic: jest.fn(),
    findById: jest.fn<Promise<User | null>, [string]>(),
  } as unknown as UsersService;

  const prisma = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  } as unknown as JwtService;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '30d';
      return undefined;
    }),
  } as any;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it('register issues access and refresh tokens', async () => {
    const user: User = {
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hash',
      role: 'Viewer',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (usersService.findByEmail as any).mockResolvedValue(null);
    (usersService.create as any).mockResolvedValue(user);
    (usersService.toPublic as any).mockReturnValue({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

    (jwtService.signAsync as any)
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');

    (jwtService.decode as any).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
    (prisma.refreshToken.create as any).mockResolvedValue({});

    const result = await authService.register({
      email: user.email,
      password: 'password123',
    });

    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(usersService.create).toHaveBeenCalled();
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('login rejects invalid password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user: User = {
      id: 'u1',
      email: 'user@example.com',
      passwordHash,
      role: 'Viewer',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (usersService.findByEmail as any).mockResolvedValue(user);

    await expect(
      authService.login({
        email: user.email,
        password: 'wrong-password',
      }),
    ).rejects.toThrow('Invalid credentials');
  });
});
