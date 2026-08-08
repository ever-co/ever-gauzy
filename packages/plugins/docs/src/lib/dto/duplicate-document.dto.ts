import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Payload for `POST /api/plugins/docs/documents/:id/duplicate`.
 * The copy starts `knowledgeStatus: NONE`, `reviewStatus: NONE`; versions, comments, shares,
 * links, and knowledge state are not copied.
 */
export class DuplicateDocumentDTO {
	/** True copies the whole subtree. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly deep?: boolean;

	/** Target parent; defaults to the source node's parent. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	/** Name for the copy; defaults to `"<name> (copy)"`. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly name?: string;
}
