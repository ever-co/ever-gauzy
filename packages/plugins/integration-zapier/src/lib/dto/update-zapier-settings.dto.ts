import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { IZapierUpdateSettingsInput } from '../zapier.types';
import { ZAPIER_WEBHOOK_URL_MAX_LENGTH } from '../zapier.config';

/** The body of `PUT /integration/zapier/settings`. */
export class UpdateZapierSettingsDto implements IZapierUpdateSettingsInput {
	@ApiProperty({ type: () => Boolean, description: 'Whether the Zapier integration is enabled' })
	@IsBoolean()
	isEnabled!: boolean;

	@ApiPropertyOptional({
		type: () => String,
		nullable: true,
		maxLength: ZAPIER_WEBHOOK_URL_MAX_LENGTH,
		description:
			'The webhook URL (HTTPS, a public host); an empty string or null clears it, and leaving it out keeps the stored one'
	})
	@IsOptional()
	@IsString()
	@MaxLength(ZAPIER_WEBHOOK_URL_MAX_LENGTH)
	webhookUrl?: string | null;
}
