import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  UsePipes, 
  ValidationPipe, 
  Headers, 
  Param,
  Query,
  Logger 
} from '@nestjs/common';
import { 
  ApiHeader, 
  ApiOperation, 
  ApiResponse, 
  ApiTags 
} from '@nestjs/swagger';
import { AIService } from 'src/ai/ai.service';
import { FirestoreService } from 'src/firestore/firestore.service';
import { 
  EvaluateRequestDto, 
  EvaluateResponseDto, 
  AttemptsResponseDto,
  AttemptsParamsDto,
  AttemptsQueryDto 
} from 'src/ai/dto';

@Controller('ai')
@UsePipes(new ValidationPipe({ 
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true 
}))
@ApiTags('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private readonly aiService: AIService,
    private readonly firestoreService: FirestoreService
  ) {}

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
    
    const metadata = this.buildMetadata(userId, userAgent, source, sessionId);
    this.logRequest(request, metadata);

    return await this.aiService.evaluateIntent(request, metadata);
  }

  @Get('logs/by-attempts/:attempts')
  @ApiOperation({ 
    summary: 'Obtener interacciones por número exacto de intentos',
    description: 'Devuelve todas las interacciones donde la IA haya requerido exactamente el número especificado de intentos. Ordenado de más reciente a más antigua.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de interacciones encontradas',
    type: AttemptsResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Parámetro attempts inválido. Debe ser 1, 2, o 3' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Error interno del servidor' 
  })
  async getInteractionsByAttempts(
    @Param() params: AttemptsParamsDto,
    @Query() query: AttemptsQueryDto
  ): Promise<AttemptsResponseDto> {
    
    const { attempts } = params;
    const resultsLimit = query.limit ? Math.min(query.limit, 100) : 50;
    
    this.logger.log(`🔍 Buscando interacciones con ${attempts} intento(s), límite: ${resultsLimit}`);

    const interactions = await this.firestoreService.getInteractionsByAttempts(attempts, resultsLimit);

    const response: AttemptsResponseDto = {
      attempts: attempts,
      total: interactions.length,
      limit: resultsLimit,
      interactions: interactions,
      timestamp: new Date()
    };

    this.logger.log(`✅ Encontradas ${interactions.length} interacciones con ${attempts} intento(s)`);

    return response;
  }

  /**
   * Construir metadata para el registro
   */
  private buildMetadata(
    userId?: string, 
    userAgent?: string, 
    source?: string, 
    sessionId?: string
  ) {
    return {
      userId: userId,
      userAgent: userAgent,
      source: source || 'api',
      sessionId: sessionId,
      clientIp: 'N/A',
      timestamp: new Date(),
      headers: {
        'user-agent': userAgent,
        'x-user-id': userId,
        'x-source': source,
        'x-session-id': sessionId
      }
    };
  }

  /**
   * Log de la solicitud para debugging
   */
  private logRequest(request: EvaluateRequestDto, metadata: any): void {
    this.logger.log('📥 AI Evaluation Request:', {
      message: request.message.substring(0, 100) + (request.message.length > 100 ? '...' : ''),
      expectedIntent: request.expectedIntent,
      userId: metadata.userId,
      source: metadata.source,
      timestamp: metadata.timestamp
    });
  }
}