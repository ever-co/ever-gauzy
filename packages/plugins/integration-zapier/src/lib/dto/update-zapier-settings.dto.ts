import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { IZapierUpdateSettingsInput } from '../zapier.types';

/** The body of `PUT /integration/zapier/settings`. */
export class UpdateZapierSettingsDto implements IZapierUpdateSettingsInput {
	@ApiProperty({ type: () => Boolean, description: 'Whether the Zapier integration is enabled' })
	@IsBoolean()
	isEnabled!: boolean;

	@ApiPropertyOptional({
		type: () => String,
		nullable: true,
		description: 'The webhook URL (HTTPS, a public host); an empty string or null clears it'
	})
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	webhookUrl?: string | null;
}
