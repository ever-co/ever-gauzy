import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID
} from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { Document } from '../entities/document.entity';

/**
 * Normalizes an array query param accepted either as repeated params or as a CSV string.
 */
const parseArrayParam = ({ value }: TransformFnParams): string[] | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (Array.isArray(value)) {
		return value;
	}
	return String(value)
		.split(',')
		.map((item: string) => item.trim())
		.filter(Boolean);
};

/**
 * Normalizes a boolean query param (`'true'`/`'false'`).
 */
const parseBooleanParam = ({ value }: TransformFnParams): boolean | undefined =>
	value === undefined || value === null || value === ''
		? undefined
		: value === true || ['true', '1', 'yes'].includes(String(value).toLowerCase());

/**
 * The complete filter set for `GET /api/plugins/docs/documents` (+ `/count` and `/facets`).
 * All params optional; array params accepted as repeated params or CSV.
 */
export class GetDocumentsQueryDTO extends BaseQueryDTO<Document> {
	@ApiPropertyOptional({ type: () => Array, enum: DocumentKindEnum, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsEnum(DocumentKindEnum, { each: true })
	readonly kind?: DocumentKindEnum[];

	@ApiPropertyOptional({ type: () => Array, enum: DocumentStatusEnum, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsEnum(DocumentStatusEnum, { each: true })
	readonly status?: DocumentStatusEnum[];

	@ApiPropertyOptional({ type: () => Array, enum: DocumentKnowledgeStatusEnum, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsEnum(DocumentKnowledgeStatusEnum, { each: true })
	readonly knowledgeStatus?: DocumentKnowledgeStatusEnum[];

	@ApiPropertyOptional({ type: () => Array, enum: DocumentReviewStatusEnum, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsEnum(DocumentReviewStatusEnum, { each: true })
	readonly reviewStatus?: DocumentReviewStatusEnum[];

	/** Shorthand for `reviewStatus=[PENDING]` (wins if both sent). */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(parseBooleanParam)
	@IsBoolean()
	readonly needsReview?: boolean;

	@ApiPropertyOptional({ type: () => Array, enum: DocumentSourceEnum, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsEnum(DocumentSourceEnum, { each: true })
	readonly source?: DocumentSourceEnum[];

	/** ANY-match against the categories M2M. */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsUUID('all', { each: true })
	readonly categoryIds?: ID[];

	/** ANY-match against the tags M2M. */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@Transform(parseArrayParam)
	@IsUUID('all', { each: true })
	readonly tagIds?: ID[];

	@ApiPropertyOptional({ type: () => String, enum: DocumentVisibilityEnum })
	@IsOptional()
	@IsEnum(DocumentVisibilityEnum)
	readonly visibility?: DocumentVisibilityEnum;

	/** Archived rows handling; default `exclude`. */
	@ApiPropertyOptional({ type: () => String, enum: ['exclude', 'include', 'only'] })
	@IsOptional()
	@IsIn(['exclude', 'include', 'only'])
	readonly archived?: 'exclude' | 'include' | 'only';

	/** Filter on the metadata-only search flag. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(parseBooleanParam)
	@IsBoolean()
	readonly searchable?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	readonly createdAtFrom?: string;

	/** Date-only values cover the whole day. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	readonly createdAtTo?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	readonly updatedAtFrom?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	readonly updatedAtTo?: string;

	/** Tree browse: direct children of the node (`'root'` = top level). Omitted = flat search. */
	@ApiPropertyOptional({ type: () => String, description: "Parent id or 'root'" })
	@IsOptional()
	@ValidateIf((it) => it.parentId !== 'root')
	@IsUUID()
	readonly parentId?: ID | 'root';

	/** Name search (case-insensitive substring). */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(256)
	readonly q?: string;

	/**
	 * `content` additionally matches `contentHtml`-derived text and `extractedText`; it requires
	 * `q.length >= DOCS_CONTENT_SEARCH_MIN_CHARS` (3) and is otherwise a 400 `DOCS_QUERY_TOO_SHORT`
	 * — the client mirrors the same minimum in its search gate.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ['name', 'content'] })
	@IsOptional()
	@IsIn(['name', 'content'])
	readonly searchIn?: 'name' | 'content';

	/** Sort field; default `updatedAt DESC` (tree browse defaults to `index ASC`). */
	@ApiPropertyOptional({ type: () => String, enum: ['name', 'updatedAt', 'createdAt', 'size', 'kind'] })
	@IsOptional()
	@IsIn(['name', 'updatedAt', 'createdAt', 'size', 'kind'])
	readonly sort?: 'name' | 'updatedAt' | 'createdAt' | 'size' | 'kind';

	@ApiPropertyOptional({ type: () => String, enum: ['ASC', 'DESC'] })
	@IsOptional()
	@IsIn(['ASC', 'DESC'])
	readonly sortOrder?: 'ASC' | 'DESC';
}
