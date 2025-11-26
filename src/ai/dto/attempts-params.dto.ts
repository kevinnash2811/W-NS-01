import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AttemptsParamsDto {
  @ApiProperty({
    description: 'Número exacto de intentos usados (1, 2, o 3)',
    minimum: 1,
    maximum: 3,
    example: 2,
    enum: [1, 2, 3]
  })
  @IsInt({ message: 'El número de intentos debe ser un número entero' })
  @Min(1, { message: 'El número de intentos debe ser al menos 1' })
  @Max(3, { message: 'El número de intentos no puede ser mayor a 3' })
  @Type(() => Number)
  attempts: number;
}