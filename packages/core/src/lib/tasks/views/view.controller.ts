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
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, ITaskView } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { CrudController, OptionParams, PaginationParams } from '../../core/crud';
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import { CreateViewDTO, UpdateViewDTO } from './dto';
import { TaskViewCreateCommand, TaskViewUpdateCommand } from './commands';

@ApiTags('Task views')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/task-views')
export class TaskViewController extends CrudController<TaskView> {
	constructor(private readonly taskViewService: TaskViewService, private readonly commandBus: CommandBus) {
		super(taskViewService);
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
	async findAll(@Query() params: PaginationParams<TaskView>): Promise<IPagination<ITaskView>> {
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
		@Query() params: OptionParams<TaskView>
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
	@Put(':id')
	@UseValidationPipe()
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateViewDTO): Promise<ITaskView> {
		return await this.commandBus.execute(new TaskViewUpdateCommand(id, entity));
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
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.taskViewService.delete(id);
	}
}
