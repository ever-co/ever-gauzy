import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
@ApiTags('Tags')
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService) {
		super(tagService);
	}
}
