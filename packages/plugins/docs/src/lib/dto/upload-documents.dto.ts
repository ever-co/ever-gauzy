import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocumentSourceEnum, DocumentVisibilityEnum, ID, IDocument } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Normalizes a multipart text part into a boolean (`'true'`/`'1'` → true).
 */
const toBoolean = ({ value }: TransformFnParams): boolean | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

/**
 * Normalizes a multipart text part into a string array (repeated parts or CSV).
 */
const toArray = ({ value }: TransformFnParams): string[] | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (Array.isArray(value)) {
		return value;
	}
	return String(value)
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
};

/**
 * Form fields accompanying the files of `POST /api/plugins/docs/documents/upload`
 * (multipart text parts — arrays accepted as repeated parts or CSV).
 *
 * `source` accepts only `UPLOAD` (default), `CHAT`, and `EDITOR` from this endpoint;
 * `EMAIL`, `INTEGRATION`, `SYSTEM`, `IMPORT` are reserved for server-side ingestion
 * paths and rejected with 400 `DOCS_SOURCE_RESERVED` (enforced in the service).
 */
export class UploadDocumentsDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: DocumentVisibilityEnum })
	@IsOptional()
	@IsEnum(DocumentVisibilityEnum)
	readonly visibility?: DocumentVisibilityEnum;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@Transform(toArray)
	@IsArray()
	@IsUUID('all', { each: true })
	readonly categoryIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@Transform(toArray)
	@IsArray()
	@IsUUID('all', { each: true })
	readonly tagIds?: ID[];

	/** Default = org setting `importToKnowledgeDefault`. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(toBoolean)
	@IsBoolean()
	readonly importToKnowledge?: boolean;

	/**
	 * Per-upload override of the org setting `autoClassify` — the "Classify with AI" toggle of
	 * the classification dialog (`01-ux-spec.md` §7.2). `false` skips the `docs.classify` stage
	 * for every file of this batch (extraction and, when the document is in knowledge, the
	 * chunk→embed→index chain still run). Omitted = follow the organization default.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(toBoolean)
	@IsBoolean()
	readonly classifyWithAi?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: DocumentSourceEnum })
	@IsOptional()
	@IsEnum(DocumentSourceEnum)
	readonly source?: DocumentSourceEnum;
}

/**
 * One accepted file of an upload batch.
 */
export interface IDocumentUploadResult {
	document: IDocument;
	/** Set when an active document in the same tenant+organization has the same sha256. */
	duplicateOfId?: ID;
}

/**
 * One rejected file of an upload batch (its bytes are never persisted).
 */
export interface IDocumentUploadRejection {
	fileName: string;
	code: string;
	message: string;
}

/**
 * The 201 envelope of the upload endpoint: per-file accept/reject results.
 */
export interface IDocumentUploadResponse {
	results: IDocumentUploadResult[];
	rejected: IDocumentUploadRejection[];
}
