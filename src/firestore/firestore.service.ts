import { Injectable } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';

@Injectable()
export class FirestoreService {
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
}