import {
	Controller,
	Get,
	Param,
	Post,
	Body,
	UseGuards,
	Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
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

	@Get()
	async getAllTags(@Query('data') data: string): Promise<IPagination<Tag>> {
		const { relations, findInput } = JSON.parse(data);
		return this.tagService.findAll({ where: findInput, relations });
	}

	@Get('getByOrgId')
	async getAllTagsByOrgLevel(@Query('data') data: any): Promise<any> {
		const { relations, orgId } = JSON.parse(data);
		return this.tagService.findTagsByOrgLevel(relations, orgId);
	}
	@Get('getByTenantId')
	async getAllTagsByTenantLevel(@Query('data') data: any): Promise<any> {
		const { relations, tenantId } = JSON.parse(data);
		return this.tagService.findTagsByTenantLevel(relations, tenantId);
	}

	@Get(`getTagsWithCount`)
	async getTagUsageCount(@Query('data') data: any): Promise<any> {
		const { orgId } = JSON.parse(data);
		return this.tagService.getTagUsageCount(orgId);
	}
}
