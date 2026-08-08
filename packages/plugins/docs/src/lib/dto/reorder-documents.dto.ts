import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID, ValidateIf } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Payload for `POST /api/plugins/docs/documents/reorder` — rewrites `index` for the listed
 * siblings. Ids that are not children of `parentId` yield 400 `DOCS_REORDER_MIXED_PARENTS`.
 */
export class ReorderDocumentsDTO {
	@ApiProperty({ type: () => String, nullable: true, description: 'Parent id; null = root siblings' })
	@ValidateIf((it) => it.parentId !== null)
	@IsUUID()
	readonly parentId: ID | null;

	@ApiProperty({ type: () => Array, description: 'Sibling ids in the desired order' })
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID('all', { each: true })
	readonly orderedIds: ID[];
}
