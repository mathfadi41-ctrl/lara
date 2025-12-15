import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL") || "redis://localhost:6379";
        const url = new URL(redisUrl);
        
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port) || 6379,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: "stream-processing",
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
