import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/**
 * Query params for `DELETE /api/plugins/docs/documents/:id`.
 * `subtree` (default) soft-deletes the descendants too; `promote-children` re-parents children
 * to the deleted node's parent, preserving relative `index` order.
 */
export class DeleteDocumentQueryDTO {
	@ApiPropertyOptional({ type: () => String, enum: ['subtree', 'promote-children'] })
	@IsOptional()
	@IsIn(['subtree', 'promote-children'])
	readonly strategy?: 'subtree' | 'promote-children';
}
