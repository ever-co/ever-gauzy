import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * An Activepieces id, as it goes into a URL path or query: letters, digits, `_` and `-` only (Activepieces ids are
 * 21 letters and digits).
 */
export const ACTIVEPIECES_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * DTO for the operator's provisioning or linking of a tenant's Activepieces project
 * (`PUT /integration/activepieces/platform/tenants/:tenantId/project`).
 */
export class LinkActivepiecesTenantProjectDto {
	@ApiPropertyOptional({
		description:
			'An existing project of the platform to give the tenant (its external id becomes the tenant\'s). ' +
			"Without it, the tenant's project is found by its external id, or created.",
		type: String,
		example: 'Hk2lGy0bF3NAufUJJpA5v'
	})
	@IsOptional()
	@IsString()
	@Transform(trim)
	@IsNotEmpty()
	@MaxLength(64)
	@Matches(ACTIVEPIECES_ID_PATTERN)
	readonly projectId?: string;
}

/**
 * DTO for the operator's list of the platform's projects (`GET /integration/activepieces/platform/projects`).
 */
export class ListActivepiecesPlatformProjectsQueryDto {
	@ApiPropertyOptional({ description: 'Filter by external id', type: String, example: 'gauzy-tenant-<tenantId>' })
	@IsOptional()
	@IsString()
	@Transform(trim)
	@MaxLength(256)
	readonly externalId?: string;

	@ApiPropertyOptional({ description: 'Filter by display name', type: String })
	@IsOptional()
	@IsString()
	@Transform(trim)
	@MaxLength(256)
	readonly displayName?: string;

	@ApiPropertyOptional({ description: 'Pagination cursor', type: String })
	@IsOptional()
	@IsString()
	@Transform(trim)
	@MaxLength(512)
	readonly cursor?: string;

	@ApiPropertyOptional({ description: 'Number of results to return', type: Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	readonly limit?: number;
}

/**
 * DTO for the operator's view of one project of the platform (its connections, its MCP servers).
 */
export class ActivepiecesPlatformProjectQueryDto {
	@ApiProperty({ description: 'Activepieces project ID', type: String, example: 'Hk2lGy0bF3NAufUJJpA5v' })
	@IsString()
	@Transform(trim)
	@IsNotEmpty()
	@MaxLength(64)
	@Matches(ACTIVEPIECES_ID_PATTERN)
	readonly projectId!: string;

	@ApiPropertyOptional({ description: 'Pagination cursor', type: String })
	@IsOptional()
	@IsString()
	@Transform(trim)
	@MaxLength(512)
	readonly cursor?: string;

	@ApiPropertyOptional({ description: 'Number of results to return', type: Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	readonly limit?: number;
}
