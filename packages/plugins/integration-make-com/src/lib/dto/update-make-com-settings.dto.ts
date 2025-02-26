import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMakeComSettingsDTO {
  @ApiProperty({ type: Boolean, required: true })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  @IsUrl(undefined, { message: 'Please provide a valid webhook URL' })
  webhookUrl?: string;
}
