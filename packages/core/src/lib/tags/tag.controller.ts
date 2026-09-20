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
	HttpStatus,
	Delete,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { ID, IPagination, ITag, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { AbstractValidationPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { TagListCommand } from './commands';
import { CreateTagDTO, TagQueryByLevelDTO, UpdateTagDTO } from './dto';

@ApiTags('Tags')
@UseGuards(TenantPermissionGuard)
@Controller('/tags')
export class TagController extends CrudController<Tag> {
	constructor(private readonly tagService: TagService, private readonly commandBus: CommandBus) {
		super(tagService);
	}

	/**
	 * Get tags by level
	 *
	 * @param query
	 */
	@Get('/level')
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
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<Tag>): Promise<any> {
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
	@Post('/')
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
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ITag['id'],
		@Body() entity: UpdateTagDTO
	): Promise<ITag | UpdateResult> {
		return await this.tagService.update(id, entity);
	}

	/**
	 * DELETE tag by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate.
	 * The tags page offers delete to ALL_ORG_EDIT or ORG_TAGS_DELETE, and edit to ORG_TAGS_EDIT; any of
	 * them passes (OR semantics), nobody else does (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully deleted'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_EDIT, PermissionsEnum.ORG_TAGS_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE tag by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate.
	 * The tags page offers delete to ALL_ORG_EDIT or ORG_TAGS_DELETE, and edit to ORG_TAGS_EDIT; any of
	 * them passes (OR semantics), nobody else does (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record soft deleted successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_EDIT, PermissionsEnum.ORG_TAGS_DELETE)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Tag> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted tag by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate.
	 * The tags page offers delete to ALL_ORG_EDIT or ORG_TAGS_DELETE, and edit to ORG_TAGS_EDIT; any of
	 * them passes (OR semantics), nobody else does (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record restored successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_EDIT, PermissionsEnum.ORG_TAGS_DELETE)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Tag> {
		return super.softRecover(id, ...options);
	}
}
