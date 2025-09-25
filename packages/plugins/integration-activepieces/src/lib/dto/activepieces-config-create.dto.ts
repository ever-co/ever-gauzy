import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { IActivepiecesIntegrationConfigCreateInput, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

export class ActivepiecesConfigCreateDto extends TenantOrganizationBaseDTO implements IActivepiecesIntegrationConfigCreateInput {
	@ApiProperty({
		type: String,
		description: 'OAuth client ID for ActivePieces integration'
	})
	@IsString()
	readonly clientId!: string;

	@ApiProperty({
		type: String,
		description: 'OAuth client secret for ActivePieces integration'
	})
	@IsString()
	readonly clientSecret!: string;

	@ApiPropertyOptional({
		type: String,
		description: 'Callback URL for OAuth flow (optional, falls back to global config)'
	})
	@IsOptional()
	@IsString()
	readonly callbackUrl?: string;

	@ApiPropertyOptional({
		type: String,
		description: 'Post-installation redirect URL (optional, falls back to global config)'
	})
	@IsOptional()
	@IsString()
	readonly postInstallUrl?: string;

	@ApiPropertyOptional({
		type: Boolean,
		default: true,
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
