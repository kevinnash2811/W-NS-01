
import {EvaluateRequestDto, EvaluateResponseDto} from 'src/ai/dto'
import { AttemptLog }                            from 'src/shared/interfaces/ai.interface';

export interface IAIService {
  evaluateIntent(request: EvaluateRequestDto): Promise<EvaluateResponseDto>;
  classifyIntentWithRetry(
    message: string, 
    expectedIntent: string, 
    previousAttempts?: AttemptLog[]
  ): Promise<any>;
}