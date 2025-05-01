import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMakeComSettingsDTO {
    @ApiProperty({
        type: Boolean,
        description: 'Whether the Make.com integration is enabled',
        example: true
    })
    @IsBoolean()
    @Transform(({ value }) => ['true', '1', true].includes(value))
    isEnabled: boolean;

    @ApiPropertyOptional({
        type: String,
        description: 'The webhook URL for Make.com integration',
        example: 'https://hook.make.com/your-webhook-path'
    })
    @IsOptional()
    @IsString()
    @IsUrl({ require_tld: false }, { message: 'Webhook URL must be a valid URL' })
    webhookUrl?: string;
}
