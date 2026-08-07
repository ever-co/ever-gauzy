import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Payload for `POST /api/plugins/docs/documents/:id/move`.
 * `parentId: null` = move to root; sibling `index` values are compacted after insert.
 */
export class MoveDocumentDTO {
	@ApiProperty({ type: () => String, nullable: true, description: 'New parent id; null = root' })
	@ValidateIf((it) => it.parentId !== null)
	@IsUUID()
	readonly parentId: ID | null;

	@ApiPropertyOptional({ type: () => Number, description: 'Target sibling position' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly index?: number;
}
