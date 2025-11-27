
import { EvaluateRequestDto, EvaluateResponseDto } from '../dto';
import { AttemptLog } from '../../shared/interfaces/ai.interface';

export interface IAIService {
  evaluateIntent(request: EvaluateRequestDto): Promise<EvaluateResponseDto>;
  classifyIntentWithRetry(
    message: string, 
    expectedIntent: string, 
    previousAttempts?: AttemptLog[]
  ): Promise<any>;
}