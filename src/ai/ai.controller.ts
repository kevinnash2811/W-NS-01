import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { FirestoreService } from '../firestore/firestore.service';
import type { 
  AIEvaluateRequest, 
  AIEvaluateResponse, 
  AttemptLog 
} from '../shared/interfaces/ai.interface';

@Controller('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private readonly aiService: AIService,
    private readonly firestoreService: FirestoreService,
  ) {}

  @Post('evaluate')
  async evaluateIntent(
    @Body() request: AIEvaluateRequest,
  ): Promise<AIEvaluateResponse> {
    const { message, expectedIntent } = request;
    const attempts: AttemptLog[] = [];
    let attempt = 1;

    this.logger.log(`Starting intent evaluation for: "${message}"`);

    //KETQ Validación inicial
    if (!message?.trim()) {
      return { ok: false, error: 'Message is required' };
    }

    while (attempt <= this.MAX_ATTEMPTS) {
      try {
        this.logger.log(`Attempt ${attempt} for expected intent: ${expectedIntent}`);
        
        const response = await this.aiService.classifyIntentWithRetry(
          message, 
          expectedIntent, 
          attempts
        );

        const attemptLog: AttemptLog = {
          attempt,
          prompt: `Enhanced prompt attempt ${attempt}`,
          response,
          timestamp: new Date(),
        };

        attempts.push(attemptLog);

        //KETQ Guardar en Firestore
        await this.firestoreService.logAttempt({
          message,
          expectedIntent,
          ...attemptLog,
        });

        //KETQ Verificar si coincide
        if (response.intent === expectedIntent) {
          this.logger.log(`Intent matched on attempt ${attempt}`);
          return {
            ok: true,
            intent: response.intent,
            attemptsUsed: attempt,
            entities: response.entities,
          };
        }

        this.logger.warn(`Attempt ${attempt} failed. Got: ${response.intent}, Expected: ${expectedIntent}`);
        
        //KETQ Preparar siguiente intento
        attempt++;
        
        if (attempt > this.MAX_ATTEMPTS) {
          break;
        }

        //KETQ Pequeña pausa entre reintentos
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        this.logger.error(`Attempt ${attempt} error: ${error.message}`);
        attempts.push({
          attempt,
          prompt: `Error in attempt ${attempt}`,
          response: { intent: 'error', entities: {}, confidence: 0 },
          timestamp: new Date(),
        });
        attempt++;
        
        if (attempt > this.MAX_ATTEMPTS) {
          break;
        }
      }
    }

    //KETQ Fallback después de todos los intentos
    const finalError = 'IA did not match expected intent after 3 attempts';
    this.logger.error(finalError);
    
    await this.firestoreService.logFinalResult({
      message,
      expectedIntent,
      attempts,
      success: false,
      error: finalError,
    });

    return { ok: false, error: finalError };
  }
}