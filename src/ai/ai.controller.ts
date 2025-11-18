import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags }               from '@nestjs/swagger';
import { AIService }                                        from 'src/ai/ai.service';
import { EvaluateRequestDto, EvaluateResponseDto }          from 'src/ai/dto';

@Controller('ai')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiTags('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluar intención de mensaje con IA' })
  @ApiResponse({ 
    status: 201, 
    description: 'Evaluación exitosa',
    type: EvaluateResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos de entrada inválidos' 
  })
  async evaluateIntent(
    @Body() request: EvaluateRequestDto,
  ): Promise<EvaluateResponseDto> {
    return await this.aiService.evaluateIntent(request);
  }
}