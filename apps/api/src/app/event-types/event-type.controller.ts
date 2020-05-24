import { IEventTypeCreateInput } from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { EventTypeCreateCommand } from './commands/event-type.create.command';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { ParseJsonPipe } from '../shared';

@ApiTags('EventType')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EventTypeController extends CrudController<EventType> {
	constructor(
		private readonly eventTypeService: EventTypeService,
		private readonly commandBus: CommandBus
	) {
		super(eventTypeService);
	}

	@ApiOperation({ summary: 'Find all event types' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found expense',
		type: EventType,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Get()
	async findAllEventTypes(
		@Query('data') data: string
	): Promise<IPagination<EventType>> {
		const { relations, findInput } = JSON.parse(data);

		return this.eventTypeService.findAll({ where: findInput, relations });
	}

	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: EventType,
		...options: any[]
	): Promise<any> {
		return this.eventTypeService.create({
			id,
			...entity,
		});
	}

	@ApiOperation({ summary: 'Find event type by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Find Event type',
		type: EventType,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Get(':id')
	async findById(
		@Param('id') id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<EventType> {
		const { relations = [] } = data;
		return this.eventTypeService.findOne(id, {
			relations,
		});
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@Post()
	async create(
		@Body() entity: IEventTypeCreateInput,
		...options: any[]
	): Promise<EventType> {
		return this.commandBus.execute(new EventTypeCreateCommand(entity));
	}
}
