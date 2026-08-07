import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { DocumentVisibilityEnum } from '@gauzy/contracts';
import { IDocumentQuotaState } from '../services/quota.calculator';

/**
 * Org-defaults block accepted by `PUT /api/plugins/docs/settings` (partial update).
 * The read-only `capabilities` and `quota` blocks of the GET response are never writable
 * (`quotaBytes` below is the ONE writable quota field — the usage numbers are computed).
 */
export class DocumentSettingsDTO {
	/** Default for the upload form's "Import to AI knowledge" toggle. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly importToKnowledgeDefault?: boolean;

	/** Default visibility for newly created documents. */
	@ApiPropertyOptional({ type: () => String, enum: DocumentVisibilityEnum })
	@IsOptional()
	@IsEnum(DocumentVisibilityEnum)
	readonly defaultVisibility?: DocumentVisibilityEnum;

	/** Whether the pipeline auto-classifies uploads (categories/summary). */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly autoClassify?: boolean;

	/**
	 * Per-organization storage quota in bytes; `0` = unlimited (08 §5.7). Overrides the
	 * deployment default `GAUZY_DOCS_ORG_QUOTA_BYTES`.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly quotaBytes?: number;
}

/**
 * The org-defaults block of the settings payloads.
 */
export interface IDocumentSettingsDefaults {
	importToKnowledgeDefault: boolean;
	defaultVisibility: DocumentVisibilityEnum;
	autoClassify: boolean;
	/** Effective organization storage quota in bytes; `0` = unlimited. */
	quotaBytes: number;
}

/**
 * Read-only deployment capabilities reported by `GET /api/plugins/docs/settings`.
 */
export interface IDocumentSettingsCapabilities {
	aiEnabled: boolean;
	vectorSearch: boolean;
	embeddingModel: string;
	maxFileSize: number;
	acceptedTypes: string[];
	/** Whether the inbound-email capture webhook is enabled in this deployment (07 §17.2). */
	inboundEmailEnabled: boolean;
}

/**
 * Full `GET /api/plugins/docs/settings` response shape.
 */
export interface IDocumentSettings {
	defaults: IDocumentSettingsDefaults;
	capabilities: IDocumentSettingsCapabilities;
	/** Live storage-quota state (quota, usage, remaining) — read-only, never writable. */
	quota: IDocumentQuotaState;
}
