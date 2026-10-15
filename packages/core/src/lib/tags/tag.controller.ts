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
import { ID, IPagination, ITag, ITagCreateInput, PermissionsEnum } from '@gauzy/contracts';
import {
	BulkExecutor,
	BulkOperation,
	BulkResult,
	IBulkCreateRequest,
	applyAsSingleCreate,
	bulkCreateRequest,
	bulkOptionsOf,
	singleRouteBody
} from './../api';
import { Idempotent } from './../idempotency/idempotent.decorator';
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
	constructor(
		private readonly tagService: TagService,
		private readonly commandBus: CommandBus,
		private readonly bulkExecutor: BulkExecutor
	) {
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
	 * POST tags in bulk
	 *
	 * One request files many tags and answers one outcome per item. The batch is the platform's —
	 * `@BulkOperation` declares what this route accepts, the executor is configured from that declaration,
	 * authorises the whole request once and refuses a batch it cannot read before writing anything.
	 *
	 * **Each item is `POST /tags`**: its body runs through that route's own validation pipe and then through
	 * that route's handler, so a batch files the rows the same items would file one by one and refuses an
	 * item for the reason that item would be refused alone. The permission is that route's — either of its
	 * two grants admits the caller — on the guard and on the declaration alike.
	 *
	 * A batch files what it can and reports the rest. **`atomic: true` is refused before item 0**
	 * (`BULK_ATOMIC_UNSUPPORTED`, declared `atomic: false`): each item runs the single create, which writes
	 * through its own repositories, so the batch cannot be rolled back as one. The route declares no dry run
	 * and no write mode either (see `bulkCreateRequest`).
	 *
	 * @param request The batch: the items, each the body `POST /tags` takes.
	 * @returns What applied, what did not, and the counts derived from both.
	 */
	@ApiOperation({ summary: 'Create tags in bulk' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The batch was applied, with one outcome per item' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request or an item could not be read, or it asked for "atomic" (BULK_ATOMIC_UNSUPPORTED)'
	})
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'BULK_LIMIT_EXCEEDED' })
	@ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'BULK_ALL_ITEMS_FAILED' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD)
	@Idempotent({ scope: 'tag.bulk', required: false, resourceType: 'tag' })
	@BulkOperation({
		resource: 'tag',
		// The platform's cap for every resource but the price and stock matrices: an item is one tag row.
		maxItems: 200,
		permission: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD],
		// Each item is the single create, which writes through its own repositories: no batch transaction.
		atomic: false
	})
	@Post('/bulk')
	async bulk(@Body() request: IBulkCreateRequest<ITagCreateInput>): Promise<BulkResult<ITagCreateInput>> {
		const batch = bulkCreateRequest(request);

		return await this.bulkExecutor.execute<ITagCreateInput>(
			batch,
			(item, context) => applyAsSingleCreate(item, context, (body) => this.createAsSingleRoute(body)),
			bulkOptionsOf(TagController, 'bulk')
		);
	}

	/**
	 * Files one item of a batch exactly as `POST /tags` files its body: through the route's own pipes, then
	 * through the route's handler.
	 *
	 * @param body The item, as the single route's body.
	 * @returns The tag filed.
	 */
	private async createAsSingleRoute(body: ITagCreateInput): Promise<ITag> {
		return await this.create(await singleRouteBody<CreateTagDTO>(TagController, 'create')(body));
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
