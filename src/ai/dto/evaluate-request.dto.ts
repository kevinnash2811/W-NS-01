import { IsString, IsIn, IsNotEmpty } from 'class-validator';
import { VALID_INTENTS } from '../../shared/interfaces/ai.interface';

export class EvaluateRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsIn(VALID_INTENTS)
  expectedIntent: string;
}