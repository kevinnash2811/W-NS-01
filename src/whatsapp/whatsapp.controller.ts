import { 
  Controller, 
  Post, 
  Get,
  Body, 
  Headers, 
  Query,
  Logger,
  HttpException,
  HttpStatus 
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { QueueService } from '../queue/queue.service';
import { WhatsAppWebhookRequestDto } from './dto/webhook-request.dto';
import { WhatsAppWebhookResponseDto } from './dto/webhook-response.dto';

@Controller('webhook/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly queueService: QueueService,
  ) {}

  // Endpoint para verificación del webhook
  @Get()
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    this.logger.log(`Webhook verification attempt: mode=${mode}, token=${token}`);

    const result = await this.whatsappService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      return result;
    } else {
      throw new HttpException('Verification failed', HttpStatus.FORBIDDEN);
    }
  }

  // Endpoint principal para recibir mensajes
  @Post()
  async handleWebhook(
    @Body() body: WhatsAppWebhookRequestDto,
    @Headers('x-webhook-id') webhookId: string,
  ): Promise<WhatsAppWebhookResponseDto> {
    const webhookIdentifier = webhookId || `webhook-${Date.now()}`;
    this.logger.log(`Received WhatsApp webhook: ${webhookIdentifier}`);

    try {
      // Validar webhook
      if (!this.whatsappService.validateWebhook(body)) {
        this.logger.warn(`Invalid webhook structure: ${webhookIdentifier}`);
        throw new HttpException('Invalid webhook structure', HttpStatus.BAD_REQUEST);
      }

      // Extraer mensaje
      const message = this.whatsappService.extractMessageFromWebhook(body);
      if (!message) {
        this.logger.warn(`No valid message in webhook: ${webhookIdentifier}`);
        return {
          status: 'ignored',
          message: 'No valid text message',
          timestamp: new Date(),
        };
      }

      this.logger.log(`Processing message from ${message.from}: "${message.text}"`);

      // Determinar intención esperada
      const expectedIntent = await this.whatsappService.determineExpectedIntent(
        message.from, 
        message.text
      );

      // Encolar para procesamiento asíncrono
      const job = await this.queueService.addAIJob(message.text, expectedIntent);
      
      // Generar respuesta rápida
      const quickResponse = this.whatsappService.generateQuickResponse(expectedIntent, {});

      this.logger.log(`Message queued for processing. Job ID: ${job.id}`);

      return {
        status: 'queued',
        message: quickResponse,
        messageId: message.id,
        expectedIntent,
        timestamp: new Date(),
      };

    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  // Endpoint para estado del sistema (opcional)
  @Get('status')
  getStatus() {
    return {
      status: 'operational',
      service: 'WhatsApp Webhook',
      timestamp: new Date(),
      version: '1.0.0',
    };
  }
}