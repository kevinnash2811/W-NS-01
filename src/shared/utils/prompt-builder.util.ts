import { Injectable } from '@nestjs/common';
import { AttemptLog } from 'src/shared/interfaces/ai.interface';

@Injectable()
export class PromptBuilder {
  private readonly trainingExamples = [
    { message: "Quiero saber el estado de mi pedido 91283", intent: "consult_order" },
    { message: "Necesito hacer un reclamo por un producto que llegó roto", intent: "complaint" },
    { message: "Mi pedido no ha llegado todavía", intent: "tracking" },
    { message: "¿Qué planes de suscripción tienen?", intent: "sales" },
    { message: "No puedo acceder a mi cuenta", intent: "support" },
    { message: "Horarios de atención", intent: "info_general" }
  ];

  buildPrompt(
    message: string, 
    previousAttempts: AttemptLog[], 
    expectedIntent: string
  ): string {
    const analysisContext = this.buildAnalysisContext(previousAttempts);
    const forbiddenContext = this.buildForbiddenContext(previousAttempts, expectedIntent);

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
${this.trainingExamples.map(ex => `- "${ex.message}" → ${ex.intent}`).join('\n')}

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

  private buildAnalysisContext(previousAttempts: AttemptLog[]): string {
    if (previousAttempts.length === 0) return '';

    const previousClassifications = previousAttempts.map(attempt => 
      `${attempt.response.intent} (confianza: ${attempt.response.confidence})`
    ).join(', ');

    return `ANÁLISIS PREVIO: En intentos anteriores se clasificó como: ${previousClassifications}. EVITA estas clasificaciones.`;
  }

  private buildForbiddenContext(previousAttempts: AttemptLog[], expectedIntent: string): string {
    const forbiddenIntents = previousAttempts
      .map(attempt => attempt.response.intent)
      .filter(intent => intent !== expectedIntent);

    if (forbiddenIntents.length === 0) return '';

    return `CLASIFICACIONES PROHIBIDAS: No uses ${forbiddenIntents.join(', ')} bajo ninguna circunstancia.`;
  }
}