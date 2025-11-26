export interface WhatsAppMessage {
  id: string;
  text: string;
  from: string;
  timestamp: Date;
  phone_number_id: string;
  display_phone_number: string;
}

export interface WhatsAppContact {
  wa_id: string;
  profile?: {
    name: string;
  };
}

export interface ProcessedMessage {
  id: string; // ID del documento en Firestore
  messageId: string; // ID del mensaje de WhatsApp
  userId: string; // ID del usuario
  originalMessage: string; // Mensaje original
  processedMessage: string; // Mensaje procesado
  intent: string; // Intención detectada
  entities: Record<string, any>; // Entidades extraídas
  confidence: number; // Confianza de la clasificación
  response: string; // Respuesta generada
  timestamp: Date; // Fecha de procesamiento
  processingTime?: number; // Tiempo de procesamiento en ms
  attempts?: number; // Número de intentos
}

export interface UserContext {
  userId?: string;
  lastIntent: string;
  conversationHistory: Array<{
    timestamp: Date;
    message: string;
    intent: string;
    response: string;
  }>;
  preferredLanguage: string;
  lastInteraction: Date;
  createdAt?: Date;
}