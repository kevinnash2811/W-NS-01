import { Controller, Post, Body, UsePipes, ValidationPipe, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags }             from '@nestjs/swagger';
import { AIService }                                                 from 'src/ai/ai.service';
import { EvaluateRequestDto, EvaluateResponseDto }                   from 'src/ai/dto';

@Controller('ai')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiTags('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('evaluate')
  @ApiOperation({ 
    summary: 'Evaluar intención de mensaje con IA',
    description: 'Clasifica un mensaje usando IA con reintentos inteligentes y guarda registro completo de la interacción'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Evaluación exitosa',
    type: EvaluateResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos de entrada inválidos' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Error interno del servidor' 
  })
  @ApiHeader({
    name: 'x-user-id',
    description: 'ID del usuario (opcional)',
    required: false,
    example: 'user-12345'
  })
  @ApiHeader({
    name: 'x-source',
    description: 'Fuente de la solicitud (opcional)',
    required: false,
    example: 'webhook'
  })
  async evaluateIntent(
    @Body() request: EvaluateRequestDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-source') source?: string,
    @Headers('x-session-id') sessionId?: string,
  ): Promise<EvaluateResponseDto> {
    
    // Construir metadata para el registro completo
    const metadata = {
      userId: userId,
      userAgent: userAgent,
      source: source || 'api',
      sessionId: sessionId,
      clientIp: 'N/A', // Podrías obtener esto de @Req() si necesitas
      timestamp: new Date(),
      headers: {
        'user-agent': userAgent,
        'x-user-id': userId,
        'x-source': source,
        'x-session-id': sessionId
      }
    };

    this.logRequest(request, metadata);

    return await this.aiService.evaluateIntent(request, metadata);
  }

  /**
   * Log de la solicitud para debugging
   */
  private logRequest(request: EvaluateRequestDto, metadata: any): void {
    console.log('📥 AI Evaluation Request:', {
      message: request.message.substring(0, 100) + (request.message.length > 100 ? '...' : ''),
      expectedIntent: request.expectedIntent,
      userId: metadata.userId,
      source: metadata.source,
      timestamp: metadata.timestamp
    });
  }
}