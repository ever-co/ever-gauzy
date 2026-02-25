import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * DTO for configuring SIM integration with an API key.
 */
export class ConfigureSimIntegrationDto extends TenantOrganizationBaseDTO {
	@ApiProperty({
		description: 'SIM API key for authentication',
		example: 'sim_...'
	})
	@IsNotEmpty()
	@IsString()
	readonly apiKey!: string;
}
