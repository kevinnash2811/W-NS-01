import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIModule } from './ai/ai.module';
import { QueueModule } from './queue/queue.module';
import { FirestoreModule } from './firestore/firestore.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AIModule,
    QueueModule,
    FirestoreModule,
    WhatsAppModule,
  ],
})
export class AppModule {}