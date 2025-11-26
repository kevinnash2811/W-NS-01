import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AttemptsQueryDto {
  @ApiProperty({
    description: 'Límite de resultados (opcional, default: 50, máximo: 100)',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 50,
    example: 25
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser al menos 1' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  @Type(() => Number)
  limit?: number;
}