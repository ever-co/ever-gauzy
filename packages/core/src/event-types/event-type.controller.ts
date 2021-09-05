import { IEventType, IEventTypeCreateInput, IPagination } from '@gauzy/contracts';
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
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { EventTypeCreateCommand } from './commands';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';

@ApiTags('EventType')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EventTypeController extends CrudController<EventType> {
	constructor(
		private readonly eventTypeService: EventTypeService,
		private readonly commandBus: CommandBus
	) {
		super(eventTypeService);
	}

	/**
	 * GET event types counts
	 * 
	 * @param filter
	 * @returns 
	 */
	@Get('count')
	@UsePipes(new ValidationPipe({ transform: true }))
	async getCount(
		@Query() filter: PaginationParams<EventType>
	): Promise<number> {
		return this.eventTypeService.count({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			...filter
		});
	}

	/**
	 * GET event types pagination  
	 * 
	 * @param filter 
	 * @returns 
	 */
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<EventType>
	): Promise<IPagination<IEventType>> {
		return this.eventTypeService.paginate(filter);
	}

	/**
	 * GET all event types
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all event types' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found expense',
		type: EventType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEventType>> {
		const { relations, findInput } = data;
		return this.eventTypeService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET event type by id
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find event type by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Find Event type',
		type: EventType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IEventType> {
		const { relations = [] } = data;
		return this.eventTypeService.findOne(id, {
			relations
		});
	}

	/**
	 * CREATE new event type
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async create(
		@Body() entity: IEventTypeCreateInput
	): Promise<IEventType> {
		return await this.commandBus.execute(
			new EventTypeCreateCommand(entity)
		);
	}

	/**
	 * UPDATE event type by id
	 * 
	 * @param id 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: EventType
	): Promise<IEventType> {
		return this.eventTypeService.create({
			id,
			...entity
		});
	}
}
