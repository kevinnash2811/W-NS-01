export class EvaluateResponseDto {
  ok: boolean;
  intent?: string;
  attemptsUsed?: number;
  error?: string;
  entities?: Record<string, any>;
  cost?: number;
}