import { Injectable, Logger }  from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import { OpenAI }              from 'openai';
import { EvaluateRequestDto, EvaluateResponseDto}      from 'src/ai/dto';
import { CostCalculator, PromptBuilder }               from 'src/shared/utils';
import { AIIntentResponse, AttemptLog, VALID_INTENTS } from 'src/shared/interfaces/ai.interface';
import { IAIService }          from 'src/ai/interface/ai-service.interface';

@Injectable()
export class AIService implements IAIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private configService: ConfigService,
    private readonly promptBuilder: PromptBuilder,
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
  async evaluateIntent(request: EvaluateRequestDto): Promise<EvaluateResponseDto> {
    const { message, expectedIntent } = request;
    const attempts: AttemptLog[] = []; // Array para trackear todos los intentos
    let attempt = 1; // Contador de intentos actual

    // Bucle principal de reintentos - hasta 3 intentos máximo
    while (attempt <= this.MAX_ATTEMPTS) {
      try {
        // Procesa un intento de clasificación
        const result = await this.processAttempt(message, expectedIntent, attempts, attempt);
        
        // Si el intento fue exitoso (la IA devolvió la intención esperada)
        if (result.success) {

          // Calcula el total de tokens usados en todos los intentos
          const totalTokens = this.calculateTotalTokens(attempts);
          
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
        // Manejo de errores durante el procesamiento del intento
        this.logger.error(`Attempt ${attempt} error: ${error.message}`);
        await this.handleAttemptError(attempts, attempt, error);
        attempt++;
        
        if (attempt > this.MAX_ATTEMPTS) break;
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    return await this.handleFinalFailure(message, expectedIntent, attempts);
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
    const prompt = this.promptBuilder.buildPrompt(message, previousAttempts, expectedIntent);
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
    attempts: AttemptLog[], // Array mutable que se va llenando con cada intento
    attempt: number // Número del intento actual (1, 2, o 3)
  ): Promise<{ success: boolean; response: AIIntentResponse }> {
 
    // Llama a la IA para clasificar el mensaje
    const response = await this.classifyIntentWithRetry(message, expectedIntent, attempts);
    
    // Crea el log de este intento para tracking
    const attemptLog: AttemptLog = {
      attempt,
      prompt: `Enhanced prompt attempt ${attempt}`,
      response,
      timestamp: new Date(),
      tokensUsed: response.estimatedTokens || 0, // Tokens consumidos en este intento
    };

    // Agrega el intento al historial
    attempts.push(attemptLog);

    // Retorna si fue exitoso y la respuesta completa
    return {
      success: response.intent === expectedIntent, // Compara lo que devolvió la IA vs lo esperado
      response
    };
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
    attempts: AttemptLog[] // Historial completo de todos los intentos fallidos
  ): Promise<EvaluateResponseDto> {
    const finalError = 'IA did not match expected intent after 3 attempts';
    
    // TODO: Aquí iría la llamada a FirestoreService para guardar el resultado final
    // await this.firestoreService.logFinalResult({
    //   message,
    //   expectedIntent,
    //   attempts,
    //   success: false,
    //   error: finalError,
    // });

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
    error: Error // Error que ocurrió
  ): Promise<void> {
    // Crea un log de error para tracking
    const errorAttempt: AttemptLog = {
      attempt,
      prompt: `Error in attempt ${attempt}`,
      response: { 
        intent: 'error', // Intención especial para indicar error
        entities: {}, // Sin entidades
        confidence: 0, // Confianza cero
        estimatedTokens: 0 // Sin tokens consumidos
      },
      timestamp: new Date(),
      tokensUsed: 0,
      error: error.message, // Mensaje del error
    };

    // Agrega el intento fallido al historial
    attempts.push(errorAttempt);
    
    // TODO: Aquí iría la llamada a FirestoreService para guardar el intento fallido
    // await this.firestoreService.logAttempt({
    //   message: 'N/A', 
    //   expectedIntent: 'N/A',
    //   ...errorAttempt
    // });
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
        Math.ceil(content.length / 4); // Estimación aproximada: 1 token ≈ 4 caracteres

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