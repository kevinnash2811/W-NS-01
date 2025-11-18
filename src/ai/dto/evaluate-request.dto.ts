import { IsString, IsIn, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty }   from '@nestjs/swagger';
import { VALID_INTENTS } from 'src/shared/interfaces/ai.interface';

export class EvaluateRequestDto {
  @ApiProperty({
    description: 'Mensaje del usuario a clasificar',
    example: 'Mi pedido no ha llegado todavía',
    minLength: 1
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message must not be empty' })
  message: string;

  @ApiProperty({
    description: 'Intención esperada para validar',
    enum: VALID_INTENTS,
    example: 'tracking'
  })
  @IsString()
  @IsIn(VALID_INTENTS, { 
    message: `Expected intent must be one of: ${VALID_INTENTS.join(', ')}` 
  })
  expectedIntent: string;
}