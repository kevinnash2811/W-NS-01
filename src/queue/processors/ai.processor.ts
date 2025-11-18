import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { FirestoreService } from '../../firestore/firestore.service';

@Processor('ai-processing')
export class AIProcessor {
  private readonly logger = new Logger(AIProcessor.name);

  constructor(
    private readonly aiService: AIService,
    private readonly firestoreService: FirestoreService,
  ) {}

  @Process('process-intent')
  async handleIntentClassification(job: Job) {
    const { message, expectedIntent, messageId } = job.data;
    
    this.logger.log(`Processing message ${messageId}: ${message}`);

    try {
      const result = await this.aiService.classifyIntentWithRetry(
        message,
        expectedIntent
      );

      // await this.firestoreService.saveFinalResult({
      //   messageId,
      //   message,
      //   expectedIntent,
      //   result,
      //   processedAt: new Date(),
      //   jobId: job.id.toString(),
      // });

      return result;
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}