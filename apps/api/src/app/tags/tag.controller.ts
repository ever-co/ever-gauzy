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
import { AuthGuard } from '@nestjs/passport';
import { CrudController, IPagination } from '../core';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';

@ApiTags('Tags')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	async getAllTags(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Tag>> {
		const { relations, findInput } = data;
		return this.tagService.findAll({
			where: findInput,
			relations
		});
	}

	@Get('getByOrgId')
	async getAllTagsByOrgLevel(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { relations, findInput } = data;
		return this.tagService.findTagsByOrgLevel(relations, findInput);
	}
	@Get('getByTenantId')
	async getAllTagsByTenantLevel(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { relations, findInput } = data;
		return this.tagService.findTagsByTenantLevel(relations, findInput);
	}

	@Get(`getTagsWithCount`)
	async getTagUsageCount(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { organizationId } = data;
		return this.tagService.getTagUsageCount(organizationId);
	}
}
