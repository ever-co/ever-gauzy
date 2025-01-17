import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { ITagUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Tag } from './../tag.entity';

export class UpdateTagDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PartialType(
			PickType(Tag, ['name', 'description', 'color', 'textColor', 'icon', 'organizationTeamId', 'tagTypeId'])
		)
	)
	implements ITagUpdateInput {}
