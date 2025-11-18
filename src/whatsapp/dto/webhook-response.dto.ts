export class WhatsAppWebhookResponseDto {
  status: 'queued' | 'processed' | 'error' | 'ignored';
  message?: string;
  error?: string;
  messageId?: string;
  expectedIntent?: string;
  timestamp: Date;
}