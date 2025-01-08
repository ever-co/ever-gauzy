import { IntersectionType, PickType } from '@nestjs/swagger';
import { ITagTypeCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { TagType } from '../tag-type.entity';

/**
 * DTO for creating a Tag Type
 */
export class CreateTagTypeDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(TagType, ['type', 'tags'] as const) // Only pick fields once
) implements ITagTypeCreateInput {}
