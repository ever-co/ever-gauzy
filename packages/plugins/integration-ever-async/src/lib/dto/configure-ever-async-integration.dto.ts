import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { EverAsyncUserMappingDto } from './ever-async-user-mapping.dto';

/**
 * DTO for configuring the Ever Async integration for the current tenant.
 *
 * Tenant/organization context is NOT part of the payload: the tenant comes from
 * `RequestContext.currentTenantId()` and the organization from the
 * `organizationId` query parameter (same convention as the Plane integration).
 */
export class ConfigureEverAsyncIntegrationDto {
	@ApiProperty({
		description: 'Base URL of the Ever Async server to connect to',
		example: 'https://async.example.com'
	})
	@IsNotEmpty()
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly serverUrl!: string;

	@ApiProperty({
		description:
			'API token used by Gauzy to call the Ever Async server. Write-only: it is stored as an integration setting and never returned by any read endpoint.',
		example: 'eva_xxxxxxxxxxxxxxxxxxxx'
	})
	@IsNotEmpty()
	@IsString()
	readonly apiToken!: string;

	@ApiPropertyOptional({
		description: 'Chat user → Gauzy employee mappings consumed by the Ever Async Gauzy connector',
		type: [EverAsyncUserMappingDto]
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => EverAsyncUserMappingDto)
	readonly userMappings?: EverAsyncUserMappingDto[];
}
