import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { QueueModule } from '../queue/queue.module';
import { FirestoreModule } from '../firestore/firestore.module';
import { AIService } from '../ai/ai.service';

@Module({
  imports: [
    QueueModule,
    FirestoreModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, AIService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}