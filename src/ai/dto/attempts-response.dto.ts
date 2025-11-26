import { ApiProperty }       from '@nestjs/swagger';
import { InteractionRecord } from 'src/shared/interfaces/ai.interface';

export class AttemptsResponseDto {
  @ApiProperty({
    description: 'Número de intentos solicitado',
    example: 2
  })
  attempts: number;

  @ApiProperty({
    description: 'Total de interacciones encontradas',
    example: 5
  })
  total: number;

  @ApiProperty({
    description: 'Límite de resultados aplicado',
    example: 50
  })
  limit: number;

  @ApiProperty({
    description: 'Lista de interacciones que usaron exactamente ese número de intentos',
    type: [Object]
  })
  interactions: InteractionRecord[];

  @ApiProperty({
    description: 'Timestamp de la consulta',
    example: '2023-12-01T10:00:00.000Z'
  })
  timestamp: Date;
}