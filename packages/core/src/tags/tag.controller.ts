import {
	Controller,
	Get,
	Param,
	Post,
	Body,
	UseGuards,
	Query,
	BadRequestException,
	HttpCode,
	Put,
	HttpStatus
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IPagination, ITag, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { TagListCommand } from './commands';
import { CreateTagDTO, TagQueryByLevelDTO, UpdateTagDTO } from './dto';

@ApiTags('Tags')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService, private readonly commandBus: CommandBus) {
		super(tagService);
	}

	/**
	 * Get tags by level
	 *
	 * @param query
	 */
	@Get('level')
	@UseValidationPipe()
	async findTagsByLevel(@Query() query: TagQueryByLevelDTO): Promise<IPagination<ITag>> {
		try {
			console.log('TagController -> findTagsByLevel -> query', query);
			return await this.tagService.findTagsByLevel(query, query.relations);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Get tags
	 *
	 * @param data
	 * @returns
	 */
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: PaginationParams<Tag>): Promise<any> {
		return await this.commandBus.execute(new TagListCommand(options.where, options.relations));
	}

	/**
	 * Create new tag
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTagDTO): Promise<ITag> {
		return await this.tagService.create(entity);
	}

	/**
	 * Update existing tag by ID
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_EDIT)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ITag['id'],
		@Body() entity: UpdateTagDTO
	): Promise<ITag | UpdateResult> {
		return await this.tagService.update(id, entity);
	}
}
