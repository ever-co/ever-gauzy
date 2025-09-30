import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { IActivepiecesIntegrationConfigUpdateInput } from '@gauzy/contracts';

export class ActivepiecesConfigUpdateDto implements IActivepiecesIntegrationConfigUpdateInput {
	@ApiPropertyOptional({
		type: String,
		description: 'OAuth client ID for ActivePieces integration'
	})
	@IsOptional()
	@IsString()
	readonly clientId?: string;

	@ApiPropertyOptional({
		type: String,
		description: 'OAuth client secret for ActivePieces integration'
	})
	@IsOptional()
	@IsString()
	readonly clientSecret?: string;

	@ApiPropertyOptional({
		type: String,
		description: 'Callback URL for OAuth flow'
	})
	@IsOptional()
	@IsString()
	readonly callbackUrl?: string;

	@ApiPropertyOptional({
		type: String,
		description: 'Post-installation redirect URL'
	})
	@IsOptional()
	@IsString()
	readonly postInstallUrl?: string;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether this configuration is active and should be used'
	})
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;

	@ApiPropertyOptional({
		type: String,
		description: 'Optional description for the configuration'
	})
	@IsOptional()
	@IsString()
	readonly description?: string;
}
