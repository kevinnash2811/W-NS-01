import { Module }          from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';

import { AIModule }        from 'src/ai/ai.module';
import { QueueModule }     from 'src/queue/queue.module';
import { FirestoreModule } from 'src/firestore/firestore.module';
import { WhatsAppModule }  from 'src/whatsapp/whatsapp.module';

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