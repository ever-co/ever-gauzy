import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * DTO for setting up ActivePieces integration with an API key
 */
export class SetupActivepiecesIntegrationDto extends TenantOrganizationBaseDTO {
	@ApiProperty({
		description: 'ActivePieces API key for authentication',
		example: 'sk-...'
	})
	@IsNotEmpty()
	@IsString()
	readonly apiKey!: string;
}
