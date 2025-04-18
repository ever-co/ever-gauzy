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
    @Transform(({ value }) => value === 'true' || value === true)
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

    @ApiPropertyOptional({
        type: String,
        description: 'Client ID for Make.com OAuth',
        example: 'your-make-client-id'
    })
    @IsOptional()
    @IsString()
    clientId?: string;

    @ApiPropertyOptional({
        type: String,
        description: 'Client Secret for Make.com OAuth',
        example: 'your-make-client-secret'
    })
    @IsOptional()
    @IsString()
    clientSecret?: string;
}
