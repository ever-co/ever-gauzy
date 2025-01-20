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
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, ITaskLinkedIssue, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import { Permissions } from '../../shared/decorators';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { CreateTaskLinkedIssueDTO, UpdateTaskLinkedIssueDTO } from './dto';
import { TaskLinkedIssueCreateCommand, TaskLinkedIssueUpdateCommand } from './commands';

@ApiTags('Linked Issue')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
@Controller('/task-linked-issue')
export class TaskLinkedIssueController extends CrudController<TaskLinkedIssue> {
	constructor(
		private readonly taskLinkedIssueService: TaskLinkedIssueService,
		private readonly commandBus: CommandBus
	) {
		super(taskLinkedIssueService);
	}

	/**
	 * Finds all task linked issues based on the provided query parameters.
	 *
	 * @param params - The pagination and filter parameters for the query.
	 * @returns A promise that resolves to a paginated list of task linked issues.
	 */
	@ApiOperation({
		summary: 'Find all'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task linked issues',
		type: TaskLinkedIssue
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<TaskLinkedIssue>): Promise<IPagination<ITaskLinkedIssue>> {
		return this.taskLinkedIssueService.findAll(params);
	}

	/**
	 * Creates a new task linked issue.
	 *
	 * @param entity - The input data for creating a task linked issue.
	 * @returns A promise that resolves to the created task linked issue.
	 */
	@ApiOperation({ summary: 'Create Task Linked Issue' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTaskLinkedIssueDTO): Promise<ITaskLinkedIssue> {
		return this.commandBus.execute(new TaskLinkedIssueCreateCommand(entity));
	}

	/**
	 * Updates an existing task linked issue.
	 *
	 * @param id - The ID of the task linked issue to update.
	 * @param entity - The input data for updating the task linked issue.
	 * @returns A promise that resolves to the updated task linked issue.
	 */
	@ApiOperation({ summary: 'Update an existing task linked issue' })
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
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTaskLinkedIssueDTO
	): Promise<ITaskLinkedIssue> {
		return this.commandBus.execute(new TaskLinkedIssueUpdateCommand(id, entity));
	}

	/**
	 * Deletes a task linked issue.
	 *
	 * @param id - The ID of the task linked issue to delete.
	 * @returns A promise that resolves to the result of the delete operation.
	 */
	@ApiOperation({ summary: 'Delete Task Linked Issue' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.taskLinkedIssueService.delete(id);
	}

	/**
	 * Soft deletes a task linked issue record.
	 *
	 * @param id - The ID of the task linked issue to soft delete.
	 * @returns A promise that resolves to the result of the soft delete operation.
	 */
	@ApiOperation({ summary: 'Soft delete Task Linked Issue record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully soft-deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Task Linked Issue record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	@Delete(':id/soft')
	@UseValidationPipe({ whitelist: true })
	async softRemove(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return this.taskLinkedIssueService.softDelete(id);
	}
}
