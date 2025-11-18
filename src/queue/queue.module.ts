import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bull';
import { QueueService }    from 'src/queue/queue.service';
import { AIProcessor }     from 'src/queue/processors/ai.processor';
import { AIModule }        from 'src/ai/ai.module';
import { FirestoreModule } from 'src/firestore/firestore.module';

@Module({
  imports: [
    // Importar los módulos que contienen los servicios necesarios
    AIModule,
    FirestoreModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'ai-processing',
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [QueueService, AIProcessor],
  exports: [QueueService],
})
export class QueueModule {}