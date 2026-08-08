import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateIf
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { DOCS_BULK_MAX_IDS } from '../docs.constants';

/**
 * Bulk actions accepted by `POST /api/plugins/docs/documents/bulk`.
 *
 * M1 implements `ARCHIVE`, `UNARCHIVE`, `SET_CATEGORIES`, `ADD_TAGS`, `REMOVE_TAGS`, `MOVE`,
 * `DELETE`; the knowledge and review actions arrive with their milestones and fail per-id with
 * `DOCS_BULK_ACTION_UNSUPPORTED` until then.
 */
export enum DocumentBulkActionEnum {
	ARCHIVE = 'ARCHIVE',
	UNARCHIVE = 'UNARCHIVE',
	SET_CATEGORIES = 'SET_CATEGORIES',
	ADD_TAGS = 'ADD_TAGS',
	REMOVE_TAGS = 'REMOVE_TAGS',
	KNOWLEDGE_IMPORT = 'KNOWLEDGE_IMPORT',
	KNOWLEDGE_EXCLUDE = 'KNOWLEDGE_EXCLUDE',
	MOVE = 'MOVE',
	DELETE = 'DELETE',
	REVIEW_APPROVE = 'REVIEW_APPROVE',
	REVIEW_REJECT = 'REVIEW_REJECT'
}

/**
 * Per-id result entry of the bulk endpoint (one HTTP 200, per-id partial failure).
 */
export interface IDocumentBulkResultItem {
	id: ID;
	ok: boolean;
	code?: string;
}

/**
 * Response envelope of the bulk endpoint.
 */
export interface IDocumentBulkResult {
	requested: number;
	succeeded: number;
	failed: number;
	results: IDocumentBulkResultItem[];
}

export class BulkDocumentActionDTO {
	@ApiProperty({ type: () => Array, description: 'Target document ids (≤200)' })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(DOCS_BULK_MAX_IDS)
	@IsUUID('all', { each: true })
	readonly ids: ID[];

	@ApiProperty({ type: () => String, enum: DocumentBulkActionEnum })
	@IsEnum(DocumentBulkActionEnum)
	readonly action: DocumentBulkActionEnum;

	/** SET_CATEGORIES — replaces; empty clears. */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly categoryIds?: ID[];

	/** ADD_TAGS / REMOVE_TAGS — additive/subtractive. */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly tagIds?: ID[];

	/** MOVE — cycle-guarded per id; null = root. */
	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((it) => it.parentId !== null)
	@IsUUID()
	readonly parentId?: ID | null;

	/** REVIEW_REJECT payload. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	readonly reason?: string;
}
