import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ITaskEstimation, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationService } from './task-estimation.service';
import { Permissions } from './../../shared/decorators';
import { CrudController } from './../../core/crud';
import { CreateTaskEstimationDTO, UpdateTaskEstimationDTO } from './dto';
import { TaskEstimationCreateCommand, TaskEstimationUpdateCommand, TaskEstimationDeleteCommand } from './commands';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { DeleteResult } from 'typeorm';

@ApiTags('Task Estimation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/task-estimation')
export class TaskEstimationController extends CrudController<TaskEstimation> {
	constructor(
		protected readonly taskEstimationService: TaskEstimationService,
		private readonly commandBus: CommandBus
	) {
		super(taskEstimationService);
	}

	/**
	 * Create new Linked Issue
	 *
	 * @param entity
	 * @returns
	 */

	@ApiOperation({ summary: 'create a task estimation' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTaskEstimationDTO): Promise<ITaskEstimation> {
		return await this.commandBus.execute(new TaskEstimationCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update an existing task estimation' })
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ITaskEstimation['id'],
		@Body() entity: UpdateTaskEstimationDTO
	): Promise<ITaskEstimation> {
		return await this.commandBus.execute(new TaskEstimationUpdateCommand(id, entity));
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ITaskEstimation['id']): Promise<DeleteResult> {
		return await this.commandBus.execute(new TaskEstimationDeleteCommand(id));
	}
}
