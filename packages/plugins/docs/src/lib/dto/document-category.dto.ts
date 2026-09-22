import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Create payload for `POST /api/plugins/docs/categories`.
 * Names are unique per organization (case-insensitive); the slug is auto-derived when absent.
 */
export class CreateDocumentCategoryDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(150)
	readonly slug?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly color?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly icon?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly description?: string;
}

/**
 * Update payload for `PUT /api/plugins/docs/categories/:id`.
 * `isSystem` rows: rename allowed, `slug` immutable (service-enforced).
 */
export class UpdateDocumentCategoryDTO extends PartialType(CreateDocumentCategoryDTO) {}

/**
 * Payload for `POST /api/plugins/docs/categories/:id/merge` — re-points all document
 * assignments to `targetId` (deduplicated), then soft-deletes the source.
 */
export class MergeDocumentCategoryDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly targetId: ID;
}
