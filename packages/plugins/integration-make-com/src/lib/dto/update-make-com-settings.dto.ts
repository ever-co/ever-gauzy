import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMakeComSettingsDTO {
  @ApiProperty({ type: Boolean, required: true, description: 'Whether Make.com integration is enabled' })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({ type: String, required: false, description: 'Webhook URL for Make.com integration' })
  @IsOptional()
  @IsString()
  @IsUrl(undefined, { message: 'Please provide a valid webhook URL' })
  webhookUrl?: string;
}
