import { Controller, Get } from '@nestjs/common';
import { FirestoreService } from 'src/firestore/firestore.service';

@Controller('health')
export class HealthController {
  constructor(private readonly firestoreService: FirestoreService) {}

  @Get('firestore')
  async checkFirestore() {
    const isConnected = await this.firestoreService.testConnection();
    return {
      service: 'firestore',
      status: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date()
    };
  }
}