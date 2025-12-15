import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Detection, RefreshToken, Role, Stream, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Backend API (e2e)', () => {
  let app: INestApplication;

  const users: User[] = [];
  const refreshTokens: RefreshToken[] = [];
  const streams: Stream[] = [];
  const detections: Detection[] = [];

  const prismaMock: Partial<PrismaService> = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.email) {
          return users.find((u) => u.email === where.email) ?? null;
        }
        if (where.id) {
          return users.find((u) => u.id === where.id) ?? null;
        }
        return null;
      },
      findMany: async () => users,
      create: async ({ data }: any) => {
        const user: User = {
          id: `u_${users.length + 1}`,
          email: data.email,
          passwordHash: data.passwordHash,
          role: (data.role ?? 'Viewer') as Role,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(user);
        return user;
      },
      update: async ({ where, data }: any) => {
        const idx = users.findIndex((u) => u.id === where.id);
        if (idx === -1) throw new Error('P2025');
        const updated: User = {
          ...users[idx],
          ...('email' in data ? { email: data.email } : {}),
          ...('role' in data ? { role: data.role } : {}),
          ...('passwordHash' in data ? { passwordHash: data.passwordHash } : {}),
          updatedAt: new Date(),
        };
        users[idx] = updated;
        return updated;
      },
      delete: async ({ where }: any) => {
        const idx = users.findIndex((u) => u.id === where.id);
        if (idx === -1) throw new Error('P2025');
        const [deleted] = users.splice(idx, 1);
        return deleted;
      },
    } as any,
    refreshToken: {
      create: async ({ data }: any) => {
        const token: RefreshToken = {
          id: data.id,
          tokenHash: data.tokenHash,
          userId: data.userId,
          expiresAt: data.expiresAt,
          revokedAt: data.revokedAt ?? null,
          createdAt: new Date(),
        };
        refreshTokens.push(token);
        return token;
      },
      findUnique: async ({ where }: any) => {
        return refreshTokens.find((t) => t.id === where.id) ?? null;
      },
      update: async ({ where, data }: any) => {
        const idx = refreshTokens.findIndex((t) => t.id === where.id);
        if (idx === -1) throw new Error('P2025');
        const updated: RefreshToken = {
          ...refreshTokens[idx],
          revokedAt: data.revokedAt ?? refreshTokens[idx].revokedAt,
        };
        refreshTokens[idx] = updated;
        return updated;
      },
    } as any,
    stream: {
      findMany: async () => streams,
      findUnique: async ({ where }: any) => {
        return streams.find((s) => s.id === where.id) ?? null;
      },
      create: async ({ data }: any) => {
        const stream: Stream = {
          id: `s_${streams.length + 1}`,
          name: data.name,
          rtspUrl: data.rtspUrl ?? null,
          webrtcUrl: data.webrtcUrl ?? null,
          detectionEnabled: data.detectionEnabled ?? false,
          isRunning: false,
          isOnline: false,
          lastHealthCheckAt: null,
          lastFrameAt: null,
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        streams.push(stream);
        return stream;
      },
      update: async ({ where, data }: any) => {
        const idx = streams.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error('P2025');
        const updated: Stream = {
          ...streams[idx],
          ...data,
          updatedAt: new Date(),
        };
        streams[idx] = updated;
        return updated;
      },
    } as any,
    detection: {
      findMany: async () => detections,
      findUnique: async ({ where }: any) => {
        return detections.find((d) => d.id === where.id) ?? null;
      },
    } as any,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    const adminPassword = 'admin-password';
    const admin: User = {
      id: 'admin_1',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(admin);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock as PrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('auth + basic CRUD flows', async () => {
    const viewer = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'viewer@example.com', password: 'viewer-pass-123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/streams')
      .set('Authorization', `Bearer ${viewer.body.accessToken}`)
      .send({ name: 'Forbidden Stream' })
      .expect(403);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-password' })
      .expect(201);

    const adminAccessToken = adminLogin.body.accessToken as string;
    const adminRefreshToken = adminLogin.body.refreshToken as string;

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: adminRefreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: 'operator@example.com',
        password: 'operator-pass-123',
        role: 'Operator',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const createdStream = await request(app.getHttpServer())
      .post('/api/streams')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ name: 'Camera 1', rtspUrl: 'rtsp://example.com/stream' })
      .expect(201);

    const streamId = createdStream.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/streams/${streamId}/start`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/streams/${streamId}/health`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/streams')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
  });
});
