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
import { CrudController } from './../core/crud';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { IPagination, ITag, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('Tags')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService) {
		super(tagService);
	}

	@Get('getByName/:name')
	async findByName(@Param('name') name: string): Promise<Tag> {
		return this.tagService.findOneByName(name);
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

	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITag>> {
		const { relations, findInput } = data;
		return this.tagService.findAll({
			where: findInput,
			relations
		});
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TAGS_EDIT)
	@Post()
	async create(
		@Body() entity: Tag
	): Promise<ITag> {
		return this.tagService.create(entity);
	}
}
