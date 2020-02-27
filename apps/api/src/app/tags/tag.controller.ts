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

	@Post()
	async createTag(
		@Body() entity: Tag,
		...options: any[]
	): Promise<Tag> {
		return this.tagService.create(entity);
	}

	@Get()
	async getAllTags(): Promise<IPagination<Tag>> {
		const test = this.tagService.findAll();
		return this.tagService.findAll();
	}
	
}
