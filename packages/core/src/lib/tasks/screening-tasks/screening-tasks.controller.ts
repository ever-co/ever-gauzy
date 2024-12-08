import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
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
import { DeleteResult } from 'typeorm';
import { ID, IPagination, IScreeningTask } from '@gauzy/contracts';
import { Permissions } from '../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { CrudController, OptionParams, PaginationParams } from '../../core/crud';
import { UseValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { ScreeningTask } from './screening-task.entity';
import { ScreeningTasksService } from './screening-tasks.service';
import { CreateScreeningTaskDTO, UpdateScreeningTaskDTO } from './dto';
import { ScreeningTaskCreateCommand, ScreeningTaskUpdateCommand } from './commands';

@ApiTags('Screening Tasks')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('screening-tasks')
export class ScreeningTasksController extends CrudController<ScreeningTask> {
	constructor(
		private readonly screeningTasksService: ScreeningTasksService,
		private readonly commandBus: CommandBus
	) {
		super(screeningTasksService);
	}

	@ApiOperation({
		summary: 'Find all screening tasks'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found screening tasks',
		type: ScreeningTask
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<ScreeningTask>): Promise<IPagination<IScreeningTask>> {
		return await this.screeningTasksService.findAll(params);
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
		@Query() params: OptionParams<ScreeningTask>
	): Promise<IScreeningTask> {
		return this.screeningTasksService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Creates Screening Task' })
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
	async create(@Body() entity: CreateScreeningTaskDTO): Promise<IScreeningTask> {
		return await this.commandBus.execute(new ScreeningTaskCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Updates an existing screening task' })
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
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateScreeningTaskDTO
	): Promise<IScreeningTask> {
		return await this.commandBus.execute(new ScreeningTaskUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete screening task' })
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
		return await this.screeningTasksService.delete(id);
	}
}
