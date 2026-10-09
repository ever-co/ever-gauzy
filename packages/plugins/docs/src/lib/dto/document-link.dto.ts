import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BaseEntityEnum, ID, IDocumentLinkCreateInput, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Create payload for `POST /api/plugins/docs/links` — idempotent on
 * `(documentId, entity, entityId)`; a duplicate returns the existing row with 200.
 */
export class CreateDocumentLinkDTO extends TenantOrganizationBaseDTO implements IDocumentLinkCreateInput {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly documentId: ID;

	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsEnum(BaseEntityEnum)
	readonly entity: BaseEntityEnum;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly entityId: ID;

	/** Display label captured at link time (`{ label?, linkedBy? }`). */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: JsonData;
}

/**
 * Query params for `GET /api/plugins/docs/links` — the "Documents panel" reverse lookup.
 *
 * Extends a partial `TenantOrganizationBaseDTO` so `organizationId` carries the same
 * `@IsOrganizationBelongsToUser()` ownership check as the sibling write DTO: a caller can never
 * name an organization they do not belong to. It stays **optional** — the service falls back to
 * the requester's current organization when it is omitted.
 */
export class GetDocumentLinksQueryDTO extends PartialType(TenantOrganizationBaseDTO) {
	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsEnum(BaseEntityEnum)
	readonly entity: BaseEntityEnum;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly entityId: ID;
}
