import { ApiProperty } from '@nestjs/swagger';

export class EvaluateResponseDto {
  @ApiProperty({
    description: 'Indica si la clasificación fue exitosa',
    example: true
  })
  ok: boolean;

  @ApiProperty({
    description: 'Intención clasificada por la IA',
    example: 'tracking',
    required: false
  })
  intent?: string;

  @ApiProperty({
    description: 'Número de intentos utilizados',
    example: 2,
    required: false
  })
  attemptsUsed?: number;

  @ApiProperty({
    description: 'Mensaje de error en caso de fallo',
    example: 'IA did not match expected intent after 3 attempts',
    required: false
  })
  error?: string;

  @ApiProperty({
    description: 'Entidades extraídas del mensaje',
    example: { orderNumber: '12345' },
    required: false
  })
  entities?: Record<string, any>;

  @ApiProperty({
    description: 'Costo total de la operación en USD',
    example: 0.000626,
    required: false
  })
  cost?: number;

  @ApiProperty({
    description: 'Total de tokens utilizados',
    example: 313,
    required: false
  })
  totalTokens?: number;
}