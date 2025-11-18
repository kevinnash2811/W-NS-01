import { ApiProperty } from '@nestjs/swagger';

export class WhatsAppWebhookResponseDto {
  @ApiProperty({
    enum: ['queued', 'processed', 'error', 'ignored'],
    example: 'queued'
  })
  status: 'queued' | 'processed' | 'error' | 'ignored';

  @ApiProperty({
    example: 'Te ayudo con el seguimiento de tu pedido...',
    required: false
  })
  message?: string;

  @ApiProperty({
    example: 'Invalid webhook structure',
    required: false
  })
  error?: string;

  @ApiProperty({
    example: 'wamid.1234567890',
    required: false
  })
  messageId?: string;

  @ApiProperty({
    example: 'tracking',
    required: false
  })
  expectedIntent?: string;

  @ApiProperty({
    example: '2023-12-01T12:00:00.000Z'
  })
  timestamp: Date;
}