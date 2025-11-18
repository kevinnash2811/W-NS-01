import { IsString, IsObject, IsOptional, IsNotEmpty } from 'class-validator';

class MessageDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

class ContactDto {
  @IsString()
  @IsNotEmpty()
  wa_id: string;

  @IsString()
  @IsOptional()
  profile?: {
    name: string;
  };
}

export class WhatsAppWebhookRequestDto {
  @IsString()
  @IsNotEmpty()
  object: string;

  @IsObject()
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