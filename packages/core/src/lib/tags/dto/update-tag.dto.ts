import { IntersectionType, PartialType } from '@nestjs/swagger';
import { ITagUpdateInput } from '@gauzy/contracts';
import { CreateTagDTO } from './create-tag.dto';

export class UpdateTagDTO extends IntersectionType(PartialType(CreateTagDTO)) implements ITagUpdateInput {}
