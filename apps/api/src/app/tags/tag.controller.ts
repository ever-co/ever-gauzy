import { Tag } from './tag.entity';
import { CrudController } from '../core';
import { TagService } from './tag.service';
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Tag')
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService) {
		super(tagService);
	}
}
