import { IntersectionType, PartialType } from '@nestjs/swagger';
import { ITagCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Tag } from './../tag.entity';

export class CreateTagDTO extends IntersectionType(
	PartialType(TenantOrganizationBaseDTO),
	Tag
) implements ITagCreateInput { }
