import { Tag } from './tag.entity';
import { CrudController, IPagination } from '../core';
import { TagService } from './tag.service';
import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Tags')
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService) {
		super(tagService);
	}
}
