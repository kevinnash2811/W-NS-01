import { Module }          from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';
import { AIController }    from 'src/ai/ai.controller';
import { AIService }       from 'src/ai/ai.service';
import { PromptBuilder }   from 'src/shared/utils/prompt-builder.util';
import { FirestoreModule } from 'src/firestore/firestore.module';
@Module({
  imports: [ConfigModule.forRoot(), FirestoreModule],
  controllers: [AIController],
  providers: [AIService, PromptBuilder],
  exports: [AIService],
})
export class AIModule {}