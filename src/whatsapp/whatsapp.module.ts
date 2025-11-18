import { Module }             from '@nestjs/common';
import { WhatsAppController } from 'src/whatsapp/whatsapp.controller';
import { WhatsAppService }    from 'src/whatsapp/whatsapp.service';
import { QueueModule }        from 'src/queue/queue.module';
import { FirestoreModule }    from 'src/firestore/firestore.module';

@Module({
  imports: [
    QueueModule,
    FirestoreModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}