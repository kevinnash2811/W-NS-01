import { Injectable, Logger }            from '@nestjs/common';
import { Firestore }                     from '@google-cloud/firestore';
import { AttemptLog, AIIntentResponse }  from 'src/shared/interfaces/ai.interface';
import { UserContext, ProcessedMessage } from 'src/whatsapp/interfaces/whatsapp.interface';

@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);
  private db: Firestore;

  constructor() {
    this.db = new Firestore({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    });
  }

  async logAttempt(data: any): Promise<void> {
    try {
      const collection = this.db.collection('ai_attempts');
      await collection.add({
        ...data,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Firestore log error:', error);
    }
  }

  async logFinalResult(data: any): Promise<void> {
    try {
      const collection = this.db.collection('ai_results');
      await collection.add({
        ...data,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Firestore final log error:', error);
    }
  }

  async getUserHistory(userId: string): Promise<{
    lastIntent: string;
    conversationHistory: Array<{
      timestamp: Date;
      message: string;
      intent: string;
      response: string;
    }>;
    preferredLanguage: string;
    lastInteraction: Date;
  }> {
    try {
      const userDoc = this.db.collection('users').doc(userId);
      const doc = await userDoc.get();

      if (!doc.exists) {
        // Crear usuario si no existe
        const defaultData = {
          lastIntent: 'info_general',
          conversationHistory: [],
          preferredLanguage: 'es',
          lastInteraction: new Date(),
          createdAt: new Date(),
        };
        await userDoc.set(defaultData);
        return defaultData;
      }

      return doc.data() as any;
    } catch (error) {
      this.logger.error(`Error getting user history for ${userId}:`, error);
      // Retornar datos por defecto en caso de error
      return {
        lastIntent: 'info_general',
        conversationHistory: [],
        preferredLanguage: 'es',
        lastInteraction: new Date(),
      };
    }
  }

  async updateUserContext(
    userId: string, 
    newMessage: string, 
    intent: string, 
    response: string
  ): Promise<void> {
    try {
      const userDoc = this.db.collection('users').doc(userId);
      const userData = await this.getUserHistory(userId);

      // Actualizar historial de conversación (mantener últimos 50 mensajes)
      const updatedHistory = [
        {
          timestamp: new Date(),
          message: newMessage,
          intent: intent,
          response: response,
        },
        ...userData.conversationHistory.slice(0, 49), // Mantener solo los últimos 50
      ];

      await userDoc.update({
        lastIntent: intent,
        conversationHistory: updatedHistory,
        lastInteraction: new Date(),
      });

      this.logger.debug(`Updated user context for ${userId} with intent: ${intent}`);
    } catch (error) {
      this.logger.error(`Error updating user context for ${userId}:`, error);
      throw error;
    }
  }

  async saveMessageResult(data: ProcessedMessage): Promise<void> {
    try {
      const collection = this.db.collection('processed_messages');
      await collection.add({
        ...data,
        timestamp: new Date(),
      });
      this.logger.debug(`Saved processed message: ${data.messageId}`);
    } catch (error) {
      this.logger.error('Error saving message result:', error);
      throw error;
    }
  }

  async getMessageHistory(userId: string, limit: number = 10): Promise<ProcessedMessage[]> {
    try {
      const collection = this.db.collection('processed_messages');
      const snapshot = await collection
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ProcessedMessage));
    } catch (error) {
      this.logger.error(`Error getting message history for ${userId}:`, error);
      return [];
    }
  }

  // Métodos auxiliares privados
  private calculateProcessingTime(attempts: AttemptLog[]): number {
    if (attempts.length < 2) return 0;
    
    const firstAttempt = attempts[0].timestamp;
    const lastAttempt = attempts[attempts.length - 1].timestamp;
    
    return lastAttempt.getTime() - firstAttempt.getTime();
  }

  private getStartDate(timeRange: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      default:
        return new Date(now.setDate(now.getDate() - 1));
    }
  }
}