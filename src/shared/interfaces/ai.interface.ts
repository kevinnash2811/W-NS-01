export interface AIEvaluateRequest {
  message: string;
  expectedIntent: string;
}

export interface AIEvaluateResponse {
  ok: boolean;
  intent?: string;
  attemptsUsed?: number;
  error?: string;
  entities?: Record<string, any>;
}

export interface AIIntentResponse {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

export interface AttemptLog {
  attempt: number;
  prompt: string;
  response: AIIntentResponse;
  timestamp: Date;
  tokensUsed?: number;
}

export const VALID_INTENTS = [
  'consult_order',
  'complaint', 
  'sales',
  'support',
  'tracking',
  'info_general'
] as const;