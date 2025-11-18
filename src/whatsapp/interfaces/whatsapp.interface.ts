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
  messageId: string;
  originalMessage: string;
  processedMessage: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  response: string;
  timestamp: Date;
}

export interface UserContext {
  userId: string;
  lastIntent: string;
  conversationHistory: Array<{
    timestamp: Date;
    message: string;
    intent: string;
    response: string;
  }>;
  preferredLanguage: string;
  lastInteraction: Date;
}