import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBase64,
	IsBoolean,
	IsDateString,
	IsDefined,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateNested
} from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The `metadata` keys a content save may write.
 *
 * 🛑 Deliberately a nested DTO with exactly one field rather than a free-form object: the
 * `document.metadata` column is a shared provenance dictionary with reserved namespaces
 * (`email`, `chat`, `migration`, `deletion`, `review`, `ai`), so an open `metadata` on the content
 * route would let an autosave clobber the AI classification or the migration provenance of the
 * row. The service merges this block into the stored value instead of replacing it.
 */
export class UpdateDocumentContentMetadataDTO {
	/**
	 * Editor extension-set version of this save (`05-editor-spec.md` §9.1) — integer, starts at 1.
	 * It is the discriminator a future loader shim keys off, so a save that omits it stays
	 * unversioned rather than being silently stamped with today's version.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly schemaVersion?: number;
}

/**
 * PAGE content save payload for `PUT /api/plugins/docs/documents/:id/content`.
 *
 * `contentJson` is canonical and is schema-validated server-side against the editor's node/mark
 * inventory (`08-permissions-security.md` §6.1) — an unknown node type, an unknown mark, a foreign
 * attribute key or a non-`http(s)`/`mailto`/`tel` link is a **400** (`DOCS_CONTENT_SCHEMA_INVALID`).
 * The client MAY send `contentHtml` (`editor.getHTML()`), which the server sanitizes before storing
 * the render cache; when it is omitted the server derives the cache from the validated JSON rather
 * than keeping the previous (now stale) HTML. A stale `expectedUpdatedAt` yields **409** with
 * `{ code: 'DOCS_CONTENT_CONFLICT', currentUpdatedAt }`; a locked document yields **423**.
 *
 * Extends a partial `TenantOrganizationBaseDTO` — the same shape as `DocumentScopeQueryDTO` on
 * the detail reads — for the editor's OPTIONAL selected-organization scope. Without it the save
 * is scoped by the token's `lastOrganizationId` (null for a non-employee user → 400, autosave
 * dies; stale when another organization of the tenant is open → 404). The inherited fields carry
 * the platform's `@IsOrganizationBelongsToUser()` ownership check, so a caller can never name an
 * organization they do not belong to — a plain `@IsUUID` here was a same-tenant
 * cross-organization write hole.
 */
export class UpdateDocumentContentDTO extends PartialType(TenantOrganizationBaseDTO) {
	/**
	 * Re-declared (not only inherited) so its validator metadata provably lives on THIS class:
	 * the route validates with `forbidNonWhitelisted`, and a client sending its standard
	 * `{ organizationId, tenantId }` scope pair must never 400 on the pair's second half because
	 * mapped-type metadata copying missed a grandparent field. Accepted but NEVER read — the
	 * tenant always comes from the request context, so validating more than the shape here
	 * would be theater.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	override readonly tenantId?: ID;

	@ApiProperty({ type: () => Object, description: 'Canonical TipTap JSON document' })
	@IsDefined()
	readonly contentJson: JsonData;

	@ApiPropertyOptional({ type: () => String, description: 'Render cache (editor.getHTML()), sanitized server-side' })
	@IsOptional()
	@IsString()
	readonly contentHtml?: string;

	/**
	 * Base64-encoded CRDT state (`Y.encodeStateAsUpdate`) for realtime co-editing groundwork
	 * (`05-editor-spec.md` §9.1 / `10-implementation-plan.md` §7.1 P6). Stored verbatim and served
	 * back; never merged server-side in v1. Rejected with 400 `DOCS_CONTENT_BINARY_TOO_LARGE` above
	 * `GAUZY_DOCS_MAX_BINARY_BYTES`.
	 */
	@ApiPropertyOptional({ type: () => String, format: 'byte' })
	@IsOptional()
	@IsBase64()
	readonly contentBinary?: string;

	/** Optimistic-concurrency token: the `updatedAt` the editor loaded. */
	@ApiProperty({ type: () => Date })
	@IsDateString()
	readonly expectedUpdatedAt: Date;

	/** True bypasses the version-snapshot debounce. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly forceSnapshot?: boolean;

	/** The editor's current mention id set — mention diff-sync runs on content save. */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly mentionEmployeeIds?: ID[];

	/** Merged (not replaced) into `document.metadata`. */
	@ApiPropertyOptional({ type: () => UpdateDocumentContentMetadataDTO })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => UpdateDocumentContentMetadataDTO)
	readonly metadata?: UpdateDocumentContentMetadataDTO;
}
