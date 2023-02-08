import { IntersectionType, PartialType } from '@nestjs/swagger';
import { ITagUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Tag } from './../tag.entity';

export class UpdateTagDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO),
    PartialType(Tag),
) implements ITagUpdateInput {}
