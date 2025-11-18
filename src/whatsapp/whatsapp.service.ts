import { Injectable, Logger }        from '@nestjs/common';
import { FirestoreService }          from 'src/firestore/firestore.service';
import { QueueService }              from 'src/queue/queue.service';
import { WhatsAppMessage, UserContext, ProcessedMessage } from 'src/whatsapp/interfaces/whatsapp.interface';
import { WhatsAppWebhookRequestDto } from 'src/whatsapp/dto/webhook-request.dto';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly queueService: QueueService,
  ) {}

  validateWebhook(body: WhatsAppWebhookRequestDto): boolean {
    try {
      // Validar estructura básica del webhook
      if (!body?.object || body.object !== 'whatsapp_business_account') {
        this.logger.warn('Invalid webhook object');
        return false;
      }

      if (!body.entry || !Array.isArray(body.entry) || body.entry.length === 0) {
        this.logger.warn('No entries in webhook');
        return false;
      }

      const entry = body.entry[0];
      if (!entry.changes || !Array.isArray(entry.changes) || entry.changes.length === 0) {
        this.logger.warn('No changes in entry');
        return false;
      }

      const change = entry.changes[0];
      if (!change.value?.messaging_product || change.value.messaging_product !== 'whatsapp') {
        this.logger.warn('Invalid messaging product');
        return false;
      }

      // ✅ Validación más específica de messages
      if (!change.value.messages || 
          !Array.isArray(change.value.messages) || 
          change.value.messages.length === 0 ||
          !change.value.messages[0] ||
          !change.value.messages[0].text ||
          !change.value.messages[0].from) {
        this.logger.warn('No valid messages in webhook');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Webhook validation error: ${error.message}`);
      return false;
    }
  }

  extractMessageFromWebhook(body: WhatsAppWebhookRequestDto): WhatsAppMessage | null {
    try {
      // Validar primero (reutiliza la validación)
      if (!this.validateWebhook(body)) {
        return null;
      }

      const change = body.entry[0].changes[0];
      const messageData = change.value.messages![0]; // ✅ Usar ! porque ya validamos
      const contactData = change.value.contacts?.[0];

      // Validaciones adicionales por seguridad
      if (!messageData.text?.trim()) {
        this.logger.warn('Message text is empty');
        return null;
      }

      if (!messageData.from?.trim()) {
        this.logger.warn('Message from is empty');
        return null;
      }

      // Crear el objeto con valores por defecto
      const whatsappMessage: WhatsAppMessage = {
        id: messageData.id || `wa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: messageData.text.trim(),
        from: messageData.from,
        timestamp: new Date(parseInt(messageData.timestamp || (Date.now() / 1000).toString()) * 1000),
        phone_number_id: change.value.metadata.phone_number_id,
        display_phone_number: change.value.metadata.display_phone_number,
      };

      this.logger.log(`Extracted message: ${whatsappMessage.id} from ${whatsappMessage.from}`);
      return whatsappMessage;

    } catch (error) {
      this.logger.error(`Error extracting message: ${error.message}`);
      return null;
    }
  }

  async determineExpectedIntent(userId: string, message: string): Promise<string> {
    try {
      const userContext = await this.getUserContext(userId);
      const keywordAnalysis = this.analyzeKeywords(message);
      const historyAnalysis = this.analyzeHistory(userContext);
      const finalIntent = this.combineAnalyses(keywordAnalysis, historyAnalysis);
      
      this.logger.log(`Determined expected intent for user ${userId}: ${finalIntent}`);
      return finalIntent;
    } catch (error) {
      this.logger.error(`Error determining intent: ${error.message}`);
      return 'info_general';
    }
  }

  private analyzeKeywords(message: string): Array<{ intent: string; score: number }> {
    const lowerMessage = message.toLowerCase();
    const keywordPatterns = {
      tracking: [
        { keyword: 'pedido', weight: 2.0 }, { keyword: 'envío', weight: 2.0 },
        { keyword: 'seguimiento', weight: 3.0 }, { keyword: 'llegar', weight: 1.5 },
      ],
      consult_order: [
        { keyword: 'estado', weight: 2.5 }, { keyword: 'número de pedido', weight: 3.0 },
      ],
      complaint: [
        { keyword: 'reclamo', weight: 3.0 }, { keyword: 'queja', weight: 3.0 },
      ],
      sales: [
        { keyword: 'precio', weight: 2.0 }, { keyword: 'comprar', weight: 2.0 },
      ],
      support: [
        { keyword: 'ayuda', weight: 1.5 }, { keyword: 'soporte', weight: 2.0 },
      ],
    };

    const scores: Record<string, number> = {};

    for (const [intent, patterns] of Object.entries(keywordPatterns)) {
      scores[intent] = patterns.reduce((score, pattern) => {
        if (lowerMessage.includes(pattern.keyword)) {
          return score + pattern.weight;
        }
        return score;
      }, 0);
    }

    return Object.entries(scores)
      .map(([intent, score]) => ({ intent, score }))
      .sort((a, b) => b.score - a.score);
  }

  private analyzeHistory(userContext: UserContext): string | null {
    if (!userContext.conversationHistory.length) {
      return null;
    }

    const lastInteraction = userContext.conversationHistory[0];
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    if (lastInteraction.timestamp > tenMinutesAgo) {
      return lastInteraction.intent;
    }

    return null;
  }

  private combineAnalyses(
    keywordAnalysis: Array<{ intent: string; score: number }>,
    historyIntent: string | null
  ): string {
    if (historyIntent && historyIntent !== 'info_general') {
      return historyIntent;
    }

    const topKeywordIntent = keywordAnalysis[0];
    if (topKeywordIntent.score >= 1.0) {
      return topKeywordIntent.intent;
    }

    return 'info_general';
  }

  async getUserContext(userId: string): Promise<UserContext> {
    try {
      return await this.firestoreService.getUserHistory(userId);
    } catch (error) {
      this.logger.warn(`Could not get user context for ${userId}, using default`);
      return {
        userId,
        lastIntent: 'info_general',
        conversationHistory: [],
        preferredLanguage: 'es',
        lastInteraction: new Date(),
      };
    }
  }

  async saveMessageProcessingResult(result: ProcessedMessage): Promise<void> {
    try {
      await this.firestoreService.saveMessageResult(result);
      await this.firestoreService.updateUserContext(
        result.userId,
        result.originalMessage,
        result.intent,
        result.response
      );
      this.logger.log(`Saved processing result for message ${result.messageId}`);
    } catch (error) {
      this.logger.error(`Error saving message result: ${error.message}`);
    }
  }

  generateQuickResponse(intent: string, entities: Record<string, any>): string {
    const responses = {
      tracking: `Te ayudo con el seguimiento de tu pedido...`,
      consult_order: `Voy a consultar el estado de tu pedido...`,
      complaint: `Lamento escuchar eso. Te ayudo con tu reclamo...`,
      sales: `Te proporciono información sobre nuestros planes...`,
      support: `Te ayudo con el soporte técnico...`,
      info_general: `Te ayudo con tu consulta...`,
    };

    return responses[intent] || responses.info_general;
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }
    
    this.logger.warn('Webhook verification failed');
    return null;
  }
}