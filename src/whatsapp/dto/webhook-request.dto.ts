import { IsString, IsObject, IsOptional, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class MessageDto {
  @ApiProperty({
    example: 'wamid.1234567890'
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    example: '573001234567'
  })
  @IsString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({
    example: 'Quiero saber el estado de mi pedido 91283'
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    example: '1701234567',
    required: false
  })
  @IsString()
  @IsOptional()
  timestamp?: string;
}

class ContactDto {
  @ApiProperty({
    example: '573001234567'
  })
  @IsString()
  @IsNotEmpty()
  wa_id: string;

  @ApiProperty({
    example: { name: 'Juan Pérez' },
    required: false
  })
  @IsObject()
  @IsOptional()
  profile?: {
    name: string;
  };
}

export class WhatsAppWebhookRequestDto {
  @ApiProperty({
    example: 'whatsapp_business_account'
  })
  @IsString()
  @IsNotEmpty()
  object: string;

  @ApiProperty({
    example: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '123456789012345'
              },
              contacts: [
                {
                  wa_id: '573001234567',
                  profile: {
                    name: 'Juan Pérez'
                  }
                }
              ],
              messages: [
                {
                  id: 'wamid.1234567890',
                  from: '573001234567',
                  text: 'Mi pedido no ha llegado todavía',
                  timestamp: '1701234567'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  })
  @IsArray()
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: ContactDto[];
        messages?: MessageDto[];
      };
      field: string;
    }>;
  }>;
}