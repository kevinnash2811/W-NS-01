import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { AttemptLog, AIIntentResponse } from 'src/shared/interfaces/ai.interface';
import { UserContext, ProcessedMessage } from 'src/whatsapp/interfaces/whatsapp.interface';

@Injectable()
export class FirestoreService implements OnModuleInit {
  private readonly logger = new Logger(FirestoreService.name);
  private db: Firestore;

  // Nombres de colecciones para mantener consistencia
  private readonly COLLECTIONS = {
    USERS: 'users',
    AI_ATTEMPTS: 'ai_attempts',
    AI_RESULTS: 'ai_results',
    PROCESSED_MESSAGES: 'processed_messages',
    COST_ANALYSIS: 'cost_analysis',
    CONNECTION_TEST: 'connection_test'
  };

  constructor() {
    this.initializeFirestore();
  }

  onModuleInit() {
    this.logger.log('Firestore service initialized');
    // Opcional: ejecutar test de conexión al iniciar
    this.testConnection().then(success => {
      if (success) {
        this.logger.log('✅ Firestore connection verified');
      } else {
        this.logger.error('❌ Firestore connection failed');
      }
    });
  }

  private initializeFirestore(): void {
    try {
      this.db = new Firestore({
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GCP_KEY_FILE,
      });
      this.logger.log('🔥 Firestore client initialized successfully');
    } catch (error) {
      this.logger.error('💥 Failed to initialize Firestore:', error);
      throw error;
    }
  }

  /**
   * Test de conexión a Firestore
   */
  async testConnection(): Promise<boolean> {
    try {
      const testRef = this.db.collection(this.COLLECTIONS.CONNECTION_TEST);
      await testRef.doc('test').set({
        timestamp: new Date(),
        message: 'Connection test successful',
        service: 'fidooo-ai'
      });
      
      const doc = await testRef.doc('test').get();
      if (doc.exists) {
        this.logger.log('✅ Firestore connection test: PASSED');
        // Limpiar prueba después de 5 segundos
        setTimeout(() => {
          testRef.doc('test').delete().catch(() => {});
        }, 5000);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('❌ Firestore connection test: FAILED', error);
      return false;
    }
  }

  /**
   * Log de intentos de IA
   */
  async logAttempt(data: {
    message: string;
    expectedIntent: string;
    attempt: number;
    prompt: string;
    response: AIIntentResponse;
    timestamp: Date;
    tokensUsed?: number;
  }): Promise<void> {
    try {
      const collection = this.db.collection(this.COLLECTIONS.AI_ATTEMPTS);
      await collection.add({
        ...data,
        timestamp: new Date(),
      });
      this.logger.debug(`📝 Logged AI attempt ${data.attempt} for message`);
    } catch (error) {
      this.logger.error('💥 Firestore logAttempt error:', error);
      throw error;
    }
  }

  /**
   * Log de resultados finales de IA
   */
  async logFinalResult(data: {
    message: string;
    expectedIntent: string;
    attempts: AttemptLog[];
    success: boolean;
    error?: string;
    finalIntent?: string;
    totalTokens?: number;
  }): Promise<void> {
    try {
      const collection = this.db.collection(this.COLLECTIONS.AI_RESULTS);
      await collection.add({
        ...data,
        timestamp: new Date(),
        totalAttempts: data.attempts.length,
        processingTime: this.calculateProcessingTime(data.attempts),
      });
      this.logger.debug(`📊 Logged final result for message: ${data.message.substring(0, 50)}...`);
    } catch (error) {
      this.logger.error('💥 Firestore logFinalResult error:', error);
      throw error;
    }
  }

  /**
   * Obtener historial del usuario
   */
  async getUserHistory(userId: string): Promise<UserContext> {
    try {
      const userDoc = this.db.collection(this.COLLECTIONS.USERS).doc(userId);
      const doc = await userDoc.get();

      if (!doc.exists) {
        // Crear usuario si no existe
        const defaultData: UserContext = {
          userId,
          lastIntent: 'info_general',
          conversationHistory: [],
          preferredLanguage: 'es',
          lastInteraction: new Date(),
          createdAt: new Date(),
        };
        await userDoc.set(defaultData);
        return defaultData;
      }

      const data = doc.data();
      return {
        userId,
        lastIntent: data?.lastIntent || 'info_general',
        conversationHistory: data?.conversationHistory || [],
        preferredLanguage: data?.preferredLanguage || 'es',
        lastInteraction: data?.lastInteraction?.toDate() || new Date(),
        createdAt: data?.createdAt?.toDate() || new Date(),
      };
    } catch (error) {
      this.logger.error(`💥 Error getting user history for ${userId}:`, error);
      // Retornar datos por defecto en caso de error
      return {
        userId,
        lastIntent: 'info_general',
        conversationHistory: [],
        preferredLanguage: 'es',
        lastInteraction: new Date(),
      };
    }
  }

  /**
   * Actualizar contexto del usuario
   */
  async updateUserContext(
    userId: string, 
    newMessage: string, 
    intent: string, 
    response: string
  ): Promise<void> {
    try {
      const userDoc = this.db.collection(this.COLLECTIONS.USERS).doc(userId);
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

      this.logger.debug(`🔄 Updated user context for ${userId} with intent: ${intent}`);
    } catch (error) {
      this.logger.error(`💥 Error updating user context for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Guardar resultado de mensaje procesado
   */
  async saveMessageResult(data: ProcessedMessage): Promise<void> {
    try {
      const collection = this.db.collection(this.COLLECTIONS.PROCESSED_MESSAGES);
      await collection.add({
        ...data,
        timestamp: new Date(),
      });
      this.logger.debug(`💾 Saved processed message: ${data.messageId}`);
    } catch (error) {
      this.logger.error('💥 Error saving message result:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de mensajes
   */
  async getMessageHistory(userId: string, limit: number = 10): Promise<ProcessedMessage[]> {
    try {
      const collection = this.db.collection(this.COLLECTIONS.PROCESSED_MESSAGES);
      const snapshot = await collection
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          messageId: data.messageId || doc.id,
          userId: data.userId || userId,
          originalMessage: data.originalMessage || '',
          processedMessage: data.processedMessage || '',
          intent: data.intent || 'info_general',
          entities: data.entities || {},
          confidence: data.confidence || 0,
          response: data.response || '',
          timestamp: data.timestamp?.toDate() || new Date(),
          processingTime: data.processingTime || 0,
          attempts: data.attempts || 0,
        } as ProcessedMessage;
      });
    } catch (error) {
      this.logger.error(`💥 Error getting message history for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Métodos para análisis y métricas
   */
  async getIntentStats(timeRange: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const collection = this.db.collection(this.COLLECTIONS.AI_RESULTS);
      const startDate = this.getStartDate(timeRange);
      
      const snapshot = await collection
        .where('timestamp', '>=', startDate)
        .get();

      const stats = {
        total: snapshot.size,
        successful: 0,
        failed: 0,
        byIntent: {} as Record<string, number>,
        avgAttempts: 0,
        totalTokens: 0,
      };

      let totalAttempts = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.success) {
          stats.successful++;
          stats.byIntent[data.finalIntent] = (stats.byIntent[data.finalIntent] || 0) + 1;
        } else {
          stats.failed++;
        }
        
        totalAttempts += data.totalAttempts || 0;
        stats.totalTokens += data.totalTokens || 0;
      });

      stats.avgAttempts = stats.total > 0 ? totalAttempts / stats.total : 0;

      return stats;
    } catch (error) {
      this.logger.error('💥 Error getting intent stats:', error);
      return {};
    }
  }

  /**
   * Guardar análisis de costos
   */
  async saveCostAnalysis(data: {
    date: Date;
    totalTokens: number;
    totalCost: number;
    requests: number;
    avgTokensPerRequest: number;
  }): Promise<void> {
    try {
      const collection = this.db.collection(this.COLLECTIONS.COST_ANALYSIS);
      await collection.add({
        ...data,
        timestamp: new Date(),
      });
      this.logger.debug('💰 Saved cost analysis');
    } catch (error) {
      this.logger.error('💥 Error saving cost analysis:', error);
      throw error;
    }
  }

  /**
   * Limpieza de datos antiguos
   */
  async cleanupOldData(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const collections = [
        this.COLLECTIONS.AI_ATTEMPTS, 
        this.COLLECTIONS.PROCESSED_MESSAGES, 
        this.COLLECTIONS.COST_ANALYSIS
      ];
      
      for (const collectionName of collections) {
        const collection = this.db.collection(collectionName);
        const snapshot = await collection
          .where('timestamp', '<', cutoffDate)
          .get();

        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        this.logger.log(`🧹 Cleaned up ${snapshot.size} old documents from ${collectionName}`);
      }
    } catch (error) {
      this.logger.error('💥 Error cleaning up old data:', error);
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