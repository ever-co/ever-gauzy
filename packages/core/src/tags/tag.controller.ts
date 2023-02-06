import {
	Controller,
	Get,
	Param,
	Post,
	Body,
	UseGuards,
	Query,
	ValidationPipe,
	UsePipes,
	BadRequestException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IPagination, ITag, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe } from './../shared/pipes';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { TagListCommand } from './commands';
import { CreateTagDTO, TagQueryByLevelDTO } from './dto';

@ApiTags('Tags')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(
		private readonly tagService: TagService,
		private readonly commandBus: CommandBus
	) {
		super(tagService);
	}

	@Get('getByName/:name')
	async findByName(@Param('name') name: string): Promise<Tag> {
		return this.tagService.findOneByName(name);
	}

	/**
	 * Get tags by level
	 *
	 * @param query
	 */
	@Get('level')
	@UsePipes(new ValidationPipe())
	async findTagsByLevel(
		@Query() query: TagQueryByLevelDTO
	): Promise<IPagination<ITag>> {
		try {
			return await this.tagService.findTagsByLevel(query, query.relations);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITag>> {
		const { relations, findInput } = data;
		return await this.commandBus.execute(
			new TagListCommand(findInput, relations)
		);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TAGS_EDIT)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(
		@Body() entity: CreateTagDTO
	): Promise<ITag> {
		return await this.tagService.create(entity);
	}
}
