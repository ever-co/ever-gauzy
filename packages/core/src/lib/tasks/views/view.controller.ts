import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, ITaskView, ITaskViewTasksPage, PermissionsEnum } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from '../../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { CrudController, FindOptionsQueryDTO, BaseQueryDTO } from '../../core/crud';
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import { CreateViewDTO, TaskViewOrderDTO, TaskViewTasksQueryDTO, UpdateViewDTO } from './dto';
import { TaskViewTasksService } from './view-tasks.service';
import { TaskViewsEnabledGuard } from '../task-views-enabled';
import { TaskViewCreateCommand, TaskViewUpdateCommand } from './commands';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

@ApiTags('Task views')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/task-views')
export class TaskViewController extends CrudController<TaskView> {
	constructor(
		private readonly taskViewService: TaskViewService,
		private readonly commandBus: CommandBus,
		private readonly viewTasks: TaskViewTasksService
	) {
		super(taskViewService);
	}

	/**
	 * The tasks of a view (FR-3): the view's filter tree (or the query's, an unsaved edit of it) with cursor pagination,
	 * the counts per group, relative dates in the caller's time zone, and the conditions that could not be applied
	 * reported (`invalidFilters`) rather than failing the request. Behind `GAUZY_TASK_VIEWS_ENABLED` (404 otherwise).
	 * Declared before `GET :id` so the static segment is never swallowed by it.
	 */
	@ApiOperation({ summary: 'The tasks of a view: cursor page, group counts, invalid filters.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'A page of the view\'s tasks.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'View not found, or the extensions are off.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A relation outside the allowlist (RELATION_NOT_ALLOWED).' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@UseGuards(TaskViewsEnabledGuard)
	@Get(':id/tasks')
	@UseValidationPipe({ transform: true, whitelist: true })
	async tasksOf(@Param('id', UUIDValidationPipe) id: ID, @Query() query: TaskViewTasksQueryDTO): Promise<ITaskViewTasksPage> {
		return this.viewTasks.tasksOf(id, query);
	}

	@ApiOperation({
		summary: 'Find all views.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found views',
		type: TaskView
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<TaskView>): Promise<IPagination<ITaskView>> {
		return await this.taskViewService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: FindOptionsQueryDTO<TaskView>
	): Promise<ITaskView> {
		return this.taskViewService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create view' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateViewDTO): Promise<ITaskView> {
		return await this.commandBus.execute(new TaskViewCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update an existing view' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Put(':id')
	@UseValidationPipe()
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateViewDTO): Promise<ITaskView> {
		return await this.commandBus.execute(new TaskViewUpdateCommand(id, entity));
	}

	/**
	 * PUT the manual order of a view: the task ids in the order the view shows them. Behind
	 * `GAUZY_TASK_VIEWS_ENABLED` (404 otherwise); a stated `expectedVersion` is refused with 409 when stale.
	 */
	@ApiOperation({ summary: "Set a view's manual task order." })
	@ApiResponse({ status: HttpStatus.OK, description: 'The view with its new order and version' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'TASK_VIEW_VERSION_CONFLICT' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found, or the extensions are off' })
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@UseGuards(TaskViewsEnabledGuard)
	@Put('/:id/order')
	@UseValidationPipe({ whitelist: true })
	async setOrder(@Param('id', UUIDValidationPipe) id: ID, @Body() input: TaskViewOrderDTO): Promise<ITaskView> {
		return await this.taskViewService.setOrder(id, input);
	}

	@ApiOperation({ summary: 'Delete view' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.taskViewService.delete(id);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ORG_TASK_EDIT`: the task edit grant
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskView> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ORG_TASK_EDIT`: the task edit grant
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_TASK_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskView> {
		return await super.softRecover(id, ...options);
	}
}
