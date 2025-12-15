import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { Env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('REDIS_URL', { infer: true });

    const commonOptions = {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null as unknown as number | null,
      retryStrategy: () => null,
    };

    this.client = url
      ? new Redis(url, commonOptions)
      : new Redis({
          host: this.config.get('REDIS_HOST', { infer: true }) ?? 'localhost',
          port: this.config.get('REDIS_PORT', { infer: true }) ?? 6379,
          password: this.config.get('REDIS_PASSWORD', { infer: true }),
          ...commonOptions,
        });

    void this.client.connect().catch(() => {
      // Connection errors should not prevent the app from booting in dev/test.
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }

    this.client.disconnect();
  }
}
