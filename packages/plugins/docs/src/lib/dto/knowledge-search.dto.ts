import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	ValidateIf
} from 'class-validator';
import { BaseEntityEnum, DocumentKindEnum, ID } from '@gauzy/contracts';
import { DEFAULT_DOCS_RETRIEVAL_TOPK_MAX } from '../docs.constants';

/**
 * Request body of `POST /api/plugins/docs/knowledge/search` (§9.1 of the AI-knowledge spec).
 */
export class KnowledgeSearchDTO {
	@ApiProperty({ type: () => String, description: 'The search query (2–500 characters)' })
	@IsString()
	@Length(2, 500)
	readonly query: string;

	/** Default 6; clamped to `GAUZY_DOCS_RETRIEVAL_TOPK_MAX` (12). */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: DEFAULT_DOCS_RETRIEVAL_TOPK_MAX })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(DEFAULT_DOCS_RETRIEVAL_TOPK_MAX)
	readonly topK?: number;

	/** Optional restriction to specific documents (≤ 20). */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20)
	@IsUUID('all', { each: true })
	readonly documentIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly categoryIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly tagIds?: ID[];

	/** FILE | PAGE — FOLDER is rejected (never indexable). */
	@ApiPropertyOptional({ type: () => Array, enum: [DocumentKindEnum.FILE, DocumentKindEnum.PAGE] })
	@IsOptional()
	@IsArray()
	@IsIn([DocumentKindEnum.FILE, DocumentKindEnum.PAGE], { each: true })
	readonly kinds?: DocumentKindEnum[];

	/** Both or neither with `entityId` — restrict to documents linked to a business record. */
	@ApiPropertyOptional({ type: () => String, enum: BaseEntityEnum })
	@ValidateIf((it) => it.entity !== undefined || it.entityId !== undefined)
	@IsEnum(BaseEntityEnum)
	readonly entity?: BaseEntityEnum;

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => it.entity !== undefined || it.entityId !== undefined)
	@IsUUID()
	readonly entityId?: ID;
}
