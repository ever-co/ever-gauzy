import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ICreateActivepiecesIntegrationInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * DTO for creating ActivePieces integration connection
 */
export class CreateActivepiecesIntegrationDto
	extends TenantOrganizationBaseDTO
	implements ICreateActivepiecesIntegrationInput
{
	@ApiProperty({
		description: 'ActivePieces access token for API authentication',
		example: 'ap_1234567890abcdef'
	})
	@IsNotEmpty()
	@IsString()
	readonly accessToken!: string;

	@ApiPropertyOptional({
		description:
			"ActivePieces project ID where the connection will be created. Required with the tenant's own API key; in the " +
			"project-token and platform-project modes the server uses the tenant's own project, and another one is refused.",
		example: 'proj_1234567890abcdef'
	})
	@IsOptional()
	@IsNotEmpty()
	@IsString()
	readonly projectId?: string;

	@ApiPropertyOptional({
		description: 'Display name for the connection (defaults to tenant name)',
		example: 'Ever Gauzy Connection'
	})
	@IsOptional()
	@IsString()
	readonly connectionName?: string;
}
