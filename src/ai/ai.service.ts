import { Injectable, Logger }  from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import { OpenAI }              from 'openai';
import { EvaluateRequestDto, EvaluateResponseDto}      from 'src/ai/dto';
import { CostCalculator } from '../shared/utils/cost-calculator.util';
import { PromptBuilder } from '../shared/utils/prompt-builder.util';
import { AIIntentResponse, AttemptLog, VALID_INTENTS, InteractionRecord } from '../shared/interfaces/ai.interface';
import { IAIService } from './interface/ai-service.interface';
import { FirestoreService } from '../firestore/firestore.service';

@Injectable()
export class AIService implements IAIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private configService: ConfigService,
    private readonly promptBuilder: PromptBuilder,
    private readonly firestoreService: FirestoreService, //Inyectar FirestoreService
  ) {
    // Inicializa el cliente de OpenAI con la API key desde variables de entorno
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  /**
   * Método principal que orquesta la evaluación de intenciones con reintentos
   * Este es el punto de entrada desde el controlador
   */
  async evaluateIntent(request: EvaluateRequestDto, metadata?: any): Promise<EvaluateResponseDto> {
    const startTime = Date.now(); //Medir tiempo total
    const { message, expectedIntent } = request;
    const attempts: AttemptLog[] = []; // Array para trackear todos los intentos
    let attempt = 1; // Contador de intentos actual

    this.logger.log(`Starting intent evaluation for: "${message}"`);

    // Bucle principal de reintentos - hasta 3 intentos máximo
    while (attempt <= this.MAX_ATTEMPTS) {
      const attemptStartTime = Date.now(); //Medir tiempo por intento
      
      try {
        // Procesa un intento de clasificación
        const result = await this.processAttempt(message, expectedIntent, attempts, attempt, attemptStartTime);
        
        // Si el intento fue exitoso (la IA devolvió la intención esperada)
        if (result.success) {
          this.logger.log(`Intent matched on attempt ${attempt}`);
          
          // Calcula el total de tokens usados en todos los intentos
          const totalTokens = this.calculateTotalTokens(attempts);
          const processingTime = Date.now() - startTime; //Tiempo total
          
          // Guardar registro completo de interacción
          await this.saveInteractionRecord({
            message,
            expectedIntent,
            attempts,
            finalResult: {
              ok: true,
              intent: result.response.intent,
              attemptsUsed: attempt,
              entities: result.response.entities,
              cost: CostCalculator.calculateCost(totalTokens),
              totalTokens,
            },
            processingTime,
            metadata
          });

          return this.buildSuccessResponse(result.response, attempt, totalTokens);
        }

        // Si falló, loggea el warning y prepara siguiente intento
        this.logger.warn(`Attempt ${attempt} failed. Got: ${result.response.intent}, Expected: ${expectedIntent}`);
        attempt++;
        
        // Si ya se alcanzó el máximo de intentos, sale del bucle
        if (attempt > this.MAX_ATTEMPTS) break;
        
        // Pequeña pausa exponencial antes del siguiente intento
        await this.delay(this.calculateDelay(attempt));

      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        // Manejo de errores durante el procesamiento del intento
        this.logger.error(`Attempt ${attempt} error: ${error.message}`);
        await this.handleAttemptError(attempts, attempt, error, attemptDuration);
        attempt++;
        
        if (attempt > this.MAX_ATTEMPTS) break;
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    const processingTime = Date.now() - startTime;
    return await this.handleFinalFailure(message, expectedIntent, attempts, processingTime, metadata);
  }

  /**
   * Clasifica la intención de un mensaje usando IA con capacidad de reintentos
   * Este método es usado internamente por processAttempt
   */
  async classifyIntentWithRetry(
    message: string, 
    expectedIntent: string,
    previousAttempts: AttemptLog[] = []
  ): Promise<AIIntentResponse> {
    // Construye el prompt dinámicamente basado en intentos anteriores
    const prompt = this.promptBuilder.buildPrompt(message, previousAttempts);
    // Llama a la API de OpenAI/Gemini
    return await this.callAI(prompt);
  }

  /**
   * Procesa un intento individual de clasificación
   * Retorna si fue exitoso y la respuesta de la IA
   */
  private async processAttempt(
    message: string,
    expectedIntent: string,
    attempts: AttemptLog[],
    attempt: number,
    attemptStartTime: number
  ): Promise<{ success: boolean; response: AIIntentResponse }> {
    this.logger.log(`Attempt ${attempt} for message: ${message}`);
    
    // Construir prompt diferente según el intento
    let prompt: string;
    if (attempt === 1) {
      // Primer intento: clasificación libre
      prompt = this.promptBuilder.buildPrompt(message, attempts);
    } else {
      // Reintentos: prompt específico para reevaluación
      prompt = this.promptBuilder.buildRetryPrompt(message, attempts, expectedIntent);
    }
    
    // Llama a la IA para clasificar el mensaje
    const response = await this.callAI(prompt);
    
    const attemptDuration = Date.now() - attemptStartTime;

    // Crea el log de este intento para tracking
    const attemptLog: AttemptLog = {
      attempt,
      prompt: prompt,
      response,
      timestamp: new Date(),
      tokensUsed: response.estimatedTokens || 0,
      duration: attemptDuration,
    };

    // Agrega el intento al historial
    attempts.push(attemptLog);

    // VALIDACIÓN: Compara lo que devolvió la IA vs lo esperado
    return {
      success: response.intent === expectedIntent, // ← Aquí se hace la validación real
      response
    };
  }

  /**
   * Guardar registro completo de interacción en Firestore
   */
  private async saveInteractionRecord(data: {
    message: string;
    expectedIntent: string;
    attempts: AttemptLog[];
    finalResult: {
      ok: boolean;
      intent?: string;
      attemptsUsed?: number;
      error?: string;
      entities?: Record<string, any>;
      cost?: number;
      totalTokens?: number;
    };
    processingTime: number;
    metadata?: any;
  }): Promise<void> {
    try {
      const interaction: InteractionRecord = {
        message: data.message,
        expectedIntent: data.expectedIntent,
        finalResult: data.finalResult,
        attemptsHistory: data.attempts,
        timestamp: new Date(),
        processingTime: data.processingTime,
        metadata: data.metadata || {},
      };

      // Guardar en Firestore usando el servicio
      await this.firestoreService.saveInteraction(interaction);
      
      this.logger.log(`💾 Interaction recorded: ${data.finalResult.ok ? 'SUCCESS' : 'FAILED'} - ${data.attempts.length} attempts`);
    } catch (error) {
      this.logger.error('💥 Error saving interaction record:', error);
      // No throw para no interrumpir el flujo principal
    }
  }

  /**
   * Construye la respuesta de éxito cuando la IA coincide con la intención esperada
   */
  private buildSuccessResponse(
    response: AIIntentResponse, // Respuesta exitosa de la IA
    attemptsUsed: number, // Cuántos intentos se necesitaron (1, 2, o 3)
    totalTokens: number // Total de tokens usados en todos los intentos
  ): EvaluateResponseDto {
    // Calcula el costo basado en el total de tokens
    const totalCost = CostCalculator.calculateCost(totalTokens);

    // Retorna la respuesta estructurada para el cliente
    return {
      ok: true,
      intent: response.intent, // Intención clasificada (debería ser igual a expectedIntent)
      attemptsUsed, // Número de intentos utilizados
      entities: response.entities, // Entidades extraídas (números de pedido, etc.)
      cost: totalCost, // Costo total en dólares
      totalTokens, // Opcional: útil para debugging y análisis
    };
  }

  /**
   * Maneja el caso cuando todos los intentos fallan
   */
  private async handleFinalFailure(
    message: string,
    expectedIntent: string,
    attempts: AttemptLog[], // Historial completo de todos los intentos fallidos
    processingTime: number, // Agregar tiempo de procesamiento
    metadata?: any // agregar metadata
  ): Promise<EvaluateResponseDto> {
    const finalError = 'IA did not match expected intent after 3 attempts';
    this.logger.error(finalError);
    
    // Guardar registro de interacción fallida
    await this.saveInteractionRecord({
      message,
      expectedIntent,
      attempts,
      finalResult: {
        ok: false,
        error: finalError,
        attemptsUsed: this.MAX_ATTEMPTS,
      },
      processingTime,
      metadata
    });

    // Retorna respuesta de error al cliente
    return {
      ok: false,
      error: finalError,
      attemptsUsed: this.MAX_ATTEMPTS, // Siempre 3 cuando falla
    };
  }

  /**
   * Maneja errores durante un intento individual (falla de API, timeout, etc.)
   */
  private async handleAttemptError(
    attempts: AttemptLog[], // Array mutable de intentos
    attempt: number, // Número del intento que falló
    error: Error, // Error que ocurrió
    duration: number //Agregar duración del intento
  ): Promise<void> {
    // Crea un log de error para tracking
    const errorAttempt: AttemptLog = {
      attempt,
      prompt: `Error in attempt ${attempt}: ${error.message}`, //Incluir error en prompt
      response: { 
        intent: 'error', // Intención especial para indicar error
        entities: {}, // Sin entidades
        confidence: 0, // Confianza cero
        estimatedTokens: 0, // Sin tokens consumidos
        reasoning: `Error: ${error.message}` //Agregar reasoning del error
      },
      timestamp: new Date(),
      tokensUsed: 0,
      duration, //Agregar duración
      error: error.message, // Mensaje del error
    };

    // Agrega el intento fallido al historial
    attempts.push(errorAttempt);
  }

  /**
   * Llama a la API de OpenAI/Gemini para clasificar la intención
   * Este es el método que realmente interactúa con el modelo de IA
   */
  private async callAI(prompt: string): Promise<AIIntentResponse> {
    try {
      // Realiza la llamada a la API de OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Modelo a utilizar
        messages: [{ role: 'user', content: prompt }], // Prompt construido
        temperature: 0.1, // Baja temperatura para respuestas consistentes
        max_tokens: 200, // Límite de tokens en la respuesta
      });

      // Extrae el contenido de la respuesta
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // Parsea la respuesta JSON de la IA
      const response = JSON.parse(content) as AIIntentResponse;
      
      // Valida que la respuesta tenga el formato correcto
      this.validateAIResponse(response);

      // Calcula tokens usados (si la API no lo proporciona, hace estimación)
      response.estimatedTokens = completion.usage?.total_tokens || 
        Math.ceil(content.length / 4); // Estimación aproximada: 1 token = 4 caracteres

      return response;

    } catch (error) {
      this.logger.error(`AI call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida que la respuesta de la IA tenga el formato y datos correctos
   * Esto SÍ es necesario porque valida la respuesta de la API externa, no el request del usuario
   */
  private validateAIResponse(response: AIIntentResponse): void {
    // Verifica que la intención devuelta sea una de las válidas
    if (!VALID_INTENTS.includes(response.intent as any)) {
      this.logger.warn(`Invalid intent received: ${response.intent}`);
      throw new Error(`AI returned invalid intent: ${response.intent}`);
    }

    // Asegura que la confianza esté en un rango válido (0-1)
    if (!response.confidence || response.confidence < 0 || response.confidence > 1) {
      response.confidence = 0.5; // Valor por defecto si no es válido
    }
  }

  /**
   * Calcula el total de tokens usados en todos los intentos
   */
  private calculateTotalTokens(attempts: AttemptLog[]): number {
    return attempts.reduce((sum, attempt) => sum + (attempt.tokensUsed || 0), 0);
  }

  /**
   * Calcula el delay exponencial entre reintentos
   * Attempt 1: 200ms, Attempt 2: 400ms, Attempt 3: 800ms
   */
  private calculateDelay(attempt: number): number {
    return Math.pow(2, attempt) * 100;
  }

  /**
   * Utilidad para hacer pausas asíncronas
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}