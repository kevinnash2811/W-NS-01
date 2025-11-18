import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { FirestoreService } from '../firestore/firestore.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AIController],
  providers: [AIService, FirestoreService],
})
export class AIModule {}