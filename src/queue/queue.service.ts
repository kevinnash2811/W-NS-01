import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('ai-processing') private readonly aiQueue: Queue,
  ) {}

  async addAIJob(message: string, expectedIntent: string) {
    return await this.aiQueue.add('process-intent', {
      message,
      expectedIntent,
      messageId: this.generateMessageId(message), // Para idempotencia
      timestamp: new Date(),
    });
  }

  private generateMessageId(message: string): string {
    // Implementación simple de idempotencia
    const crypto = require('crypto');
    return crypto.createHash('md5').update(message).digest('hex');
  }
}