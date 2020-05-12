import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
@ApiTags('Tags')
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService) {
		super(tagService);
	}

	@Get('getByName/:name')
	async findByName(@Param('name') name: string): Promise<Tag> {
		return this.tagService.findOneByName(name);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TAGS_EDIT)
	@Post()
	async createRecord(@Body() entity: Tag): Promise<any> {
		return this.tagService.create(entity);
	}
}
