import { Injectable } from '@nestjs/common';
import { AttemptLog } from 'src/shared/interfaces/ai.interface';

@Injectable()
export class PromptBuilder {
  // Ejemplos genéricos permitidos (NO del dataset de evaluación)
  private readonly trainingExamples = [
    { 
      message: "¿Dónde está mi paquete?", 
      intent: "tracking",
      reasoning: "El usuario pregunta por la ubicación o estado de envío de un paquete"
    },
    { 
      message: "El producto que recibí está dañado", 
      intent: "complaint",
      reasoning: "El usuario reporta un producto en mal estado o defectuoso"
    },
    { 
      message: "Quiero información sobre sus servicios", 
      intent: "sales",
      reasoning: "El usuario solicita información comercial o de productos"
    },
    { 
      message: "No puedo iniciar sesión en mi cuenta", 
      intent: "support",
      reasoning: "El usuario tiene problemas técnicos o de acceso"
    },
    { 
      message: "Cuál es el número de mi pedido 12345?", 
      intent: "consult_order",
      reasoning: "El usuario consulta información específica de un pedido existente"
    },
    { 
      message: "Horarios de atención al cliente", 
      intent: "info_general",
      reasoning: "El usuario solicita información general no específica"
    }
  ];

  buildPrompt(
    message: string, 
    previousAttempts: AttemptLog[] = []
  ): string {
    const contextFromPreviousAttempts = this.buildContextFromPreviousAttempts(previousAttempts);

    return `
ROLE: Eres un clasificador especializado en intenciones de servicio al cliente.

INTENCIONES VÁLIDAS (debes usar EXCLUSIVAMENTE una de estas):
- consult_order: Consultas sobre estado, detalles o información de pedidos existentes
- complaint: Reclamos, quejas, productos defectuosos, mal servicio
- sales: Consultas comerciales, precios, productos, promociones, cotizaciones
- support: Problemas técnicos, acceso, configuración, uso de plataforma
- tracking: Seguimiento de envíos, ubicación en tiempo real, tiempo de entrega
- info_general: Información general, horarios, políticas, FAQs no específicas

EJEMPLOS DE CLASIFICACIÓN (para entender el contexto):
${this.trainingExamples.map(ex => 
  `MENSAJE: "${ex.message}" → INTENCIÓN: ${ex.intent} (RAZÓN: ${ex.reasoning})`
).join('\n')}

${contextFromPreviousAttempts}

INSTRUCCIONES PARA CLASIFICAR:
1. Analiza SEMÁNTICAMENTE el mensaje del usuario
2. Identifica la intención PRINCIPAL más adecuada
3. Considera el contexto y patrones lingüísticos
4. Si hay ambigüedad, elige la intención más probable
5. Extrae entidades relevantes (números, referencias, productos)

MENSAJE A CLASIFICAR: "${message}"

RESPONDER EXCLUSIVAMENTE EN FORMATO JSON:
{
  "intent": "una_de_las_intenciones_válidas",
  "entities": { "clave": "valor" },
  "confidence": 0.95,
  "reasoning": "Explicación breve de por qué esta intención es la correcta"
}

IMPORTANTE:
- "intent" DEBE ser una de las 6 intenciones válidas listadas arriba
- "confidence" debe reflejar tu certeza (0.0 a 1.0)
- "entities" debe contener datos extraídos como números de pedido, productos, etc.
- Sé objetivo en tu clasificación, no asumas contexto no presente en el mensaje
    `.trim();
  }

  private buildContextFromPreviousAttempts(previousAttempts: AttemptLog[]): string {
    if (previousAttempts.length === 0) return '';

    const lastAttempt = previousAttempts[previousAttempts.length - 1];
    
    return `CONTEXTO DE REINTENTO: 
En la clasificación anterior, el mensaje fue interpretado como "${lastAttempt.response.intent}" 
pero necesitamos reevaluar con más precisión. Analiza cuidadosamente la intención real.`;
  }

  // Nuevo método para prompts de reintento específico
  buildRetryPrompt(
    message: string,
    previousAttempts: AttemptLog[],
    expectedIntent: string
  ): string {
    const previousIntents = previousAttempts
      .map(attempt => attempt.response.intent)
      .join(', ');

    return `
REANÁLISIS REQUERIDO - CLASIFICACIÓN PRECISA

MENSAJE ORIGINAL: "${message}"
CLASIFICACIONES ANTERIORES: ${previousIntents}
INTENCIÓN ESPERADA PARA VALIDACIÓN: ${expectedIntent}

INSTRUCCIONES ESPECÍFICAS:
1. Reanaliza el mensaje original objetivamente
2. Considera por qué clasificaciones anteriores pudieron ser incorrectas
3. Identifica la intención MÁS ADECUADA basada solo en el contenido del mensaje
4. NO te dejes influenciar por la "intención esperada" - esta es solo para validación posterior
5. Si el mensaje claramente corresponde a "${expectedIntent}", clasifícalo así
6. Si corresponde a otra intención, sé honesto en tu clasificación

Tu rol es clasificar con precisión, no adivinar lo que queremos escuchar.

RESPONDER EN FORMATO JSON (mismo formato que antes):
    `.trim();
  }
}