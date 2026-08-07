import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { DocumentVisibilityEnum } from '@gauzy/contracts';

/**
 * Org-defaults block accepted by `PUT /api/plugins/docs/settings` (partial update).
 * The read-only `capabilities` block of the GET response is never writable.
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
}

/**
 * The org-defaults block of the settings payloads.
 */
export interface IDocumentSettingsDefaults {
	importToKnowledgeDefault: boolean;
	defaultVisibility: DocumentVisibilityEnum;
	autoClassify: boolean;
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
}

/**
 * Full `GET /api/plugins/docs/settings` response shape.
 */
export interface IDocumentSettings {
	defaults: IDocumentSettingsDefaults;
	capabilities: IDocumentSettingsCapabilities;
}
