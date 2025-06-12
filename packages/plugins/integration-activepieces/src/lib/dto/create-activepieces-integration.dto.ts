import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ICreateActivepiecesIntegrationInput } from '../activepieces.type';
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

	@ApiProperty({
		description: 'ActivePieces project ID where the connection will be created',
		example: 'proj_1234567890abcdef'
	})
	@IsNotEmpty()
	@IsString()
	readonly projectId!: string;

	@ApiPropertyOptional({
		description: 'Display name for the connection (defaults to tenant name)',
		example: 'Ever Gauzy Connection'
	})
	@IsOptional()
	@IsString()
	readonly connectionName?: string;
}
