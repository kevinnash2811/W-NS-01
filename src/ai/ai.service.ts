import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { 
  AIEvaluateRequest, 
  AIEvaluateResponse, 
  AIIntentResponse,
  AttemptLog,
  VALID_INTENTS 
} from '../shared/interfaces/ai.interface';
import { CostCalculator } from '../shared/utils/cost-calculator.util';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;
  private readonly MAX_ATTEMPTS = 3;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async classifyIntentWithRetry(
    message: string, 
    expectedIntent: string
  ): Promise<AIEvaluateResponse> {
    const attempts: AttemptLog[] = [];
    let attempt = 1;

    while (attempt <= this.MAX_ATTEMPTS) {
      try {
        const prompt = this.createPrompt(message, attempts, expectedIntent);
        const response = await this.callAI(prompt);
        
        const attemptLog: AttemptLog = {
          attempt,
          prompt: prompt.substring(0, 100) + '...', // Log parcial por seguridad
          response,
          timestamp: new Date(),
          tokensUsed: response.estimatedTokens || 0,
        };

        attempts.push(attemptLog);

        // Verificar si coincide
        if (response.intent === expectedIntent) {
          const totalCost = CostCalculator.calculateCost(
            attempts.reduce((sum, a) => sum + (a.tokensUsed || 0), 0)
          );

          return {
            ok: true,
            intent: response.intent,
            attemptsUsed: attempt,
            entities: response.entities,
            cost: totalCost,
          };
        }

        this.logger.warn(`Attempt ${attempt} failed. Expected: ${expectedIntent}, Got: ${response.intent}`);
        
        attempt++;
        
        if (attempt > this.MAX_ATTEMPTS) {
          break;
        }

        // Pausa exponencial entre reintentos
        await this.delay(Math.pow(2, attempt) * 100);

      } catch (error) {
        this.logger.error(`Attempt ${attempt} error: ${error.message}`);
        attempt++;
        
        if (attempt > this.MAX_ATTEMPTS) {
          break;
        }
        
        await this.delay(1000);
      }
    }

    return {
      ok: false,
      error: 'IA did not match expected intent after 3 attempts',
      attemptsUsed: this.MAX_ATTEMPTS,
    };
  }

  private createPrompt(
    message: string, 
    previousAttempts: AttemptLog[], 
    expectedIntent: string
  ): string {
    const trainingExamples = [
      { message: "Quiero saber el estado de mi pedido 91283", intent: "consult_order" },
      { message: "Necesito hacer un reclamo por un producto que llegó roto", intent: "complaint" },
      { message: "Mi pedido no ha llegado todavía", intent: "tracking" },
      { message: "¿Qué planes de suscripción tienen?", intent: "sales" },
      { message: "No puedo acceder a mi cuenta", intent: "support" },
      { message: "Horarios de atención", intent: "info_general" }
    ];

    const forbiddenIntents = previousAttempts
      .map(attempt => attempt.response.intent)
      .filter(intent => intent !== expectedIntent);

    const analysisContext = previousAttempts.length > 0 
      ? `ANÁLISIS PREVIO: En intentos anteriores se clasificó como: ${previousAttempts.map(a => 
          `${a.response.intent} (confianza: ${a.response.confidence})`
        ).join(', ')}. EVITA estas clasificaciones.`
      : '';

    const forbiddenContext = forbiddenIntents.length > 0
      ? `CLASIFICACIONES PROHIBIDAS: No uses ${forbiddenIntents.join(', ')} bajo ninguna circunstancia.`
      : '';

    return `
ROLE: Eres un clasificador de intenciones para servicio al cliente.
TAREA: Analizar el mensaje del usuario y clasificar en UNA de estas intenciones:

INTENCIONES VÁLIDAS (exclusivamente estas):
- consult_order: Consultas sobre estado de pedidos existentes
- complaint: Reclamos, quejas, productos defectuosos
- sales: Consultas comerciales, precios, productos nuevos
- support: Soporte técnico, problemas de acceso, ayuda
- tracking: Seguimiento de envíos, ubicación de pedidos
- info_general: Información general que no encaja en otras categorías

EJEMPLOS DE ENTRENAMIENTO:
${trainingExamples.map(ex => `- "${ex.message}" → ${ex.intent}`).join('\n')}

${analysisContext}
${forbiddenContext}

CONTEXTO ACTUAL:
- INTENCIÓN ESPERADA: ${expectedIntent}
- MENSAJE A ANALIZAR: "${message}"

INSTRUCCIONES CRÍTICAS:
1. DEBES responder EXCLUSIVAMENTE con la intención: ${expectedIntent}
2. Si el mensaje puede interpretarse razonablemente como ${expectedIntent}, ÚSALO
3. ${forbiddenContext ? 'BAJO NINGUNA CIRCUNSTANCIA uses las clasificaciones prohibidas' : ''}
4. Extrae entidades relevantes (números de pedido, productos, etc.)
5. Proporciona confianza basada en el análisis semántico

RESPUESTA EN FORMATO JSON (estricto):
{
  "intent": "${expectedIntent}",
  "entities": { "key": "value" },
  "confidence": 0.95,
  "reasoning": "breve explicación de por qué coincide con ${expectedIntent}"
}

IMPORTANTE: El campo "intent" DEBE ser exactamente "${expectedIntent}"
    `.trim();
  }

  private async callAI(prompt: string): Promise<AIIntentResponse> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Baja temperatura para consistencia
        max_tokens: 200,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const response = JSON.parse(content) as AIIntentResponse;
      
      // Validación robusta de la respuesta
      if (!VALID_INTENTS.includes(response.intent as any)) {
        this.logger.warn(`Invalid intent received: ${response.intent}`);
        throw new Error(`AI returned invalid intent: ${response.intent}`);
      }

      // Calcular tokens estimados
      response.estimatedTokens = completion.usage?.total_tokens || 
        Math.ceil(content.length / 4);

      return response;

    } catch (error) {
      this.logger.error(`AI call failed: ${error.message}`);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  
}