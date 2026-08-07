import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CreateDocumentDTO } from './create-document.dto';

/**
 * Partial **metadata-only** update for `PUT /api/plugins/docs/documents/:id`.
 *
 * `kind` is immutable and content saves go through `PUT /:id/content` — the content fields are
 * omitted here so `forbidNonWhitelisted` rejects them with 400.
 *
 * `parentId` and `index` are omitted for the same reason: re-parenting is a **tree** operation
 * and belongs exclusively to `POST /:id/move`, which is cycle-guarded and rejects a FILE parent.
 * Writing `parentId` straight through this endpoint bypassed both guards and could build a
 * cycle that the ancestor walks then had to survive.
 */
export class UpdateDocumentDTO extends PartialType(
	OmitType(CreateDocumentDTO, [
		'kind',
		'contentJson',
		'contentHtml',
		'importToKnowledge',
		'parentId',
		'index'
	] as const)
) {
	/** False = metadata-only search (content excluded from lexical search). */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly searchable?: boolean;

	/** View-only lock on a PAGE. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isLocked?: boolean;

	/** Human override of the AI summary. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly summary?: string;
}
