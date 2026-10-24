import { ID, IEventType, IEventTypeCreateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Post,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { Permissions } from './../shared/decorators';
import { AbstractValidationPipe, ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { EventTypeCreateCommand } from './commands';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';

@ApiTags('EventType')
@UseGuards(TenantPermissionGuard)
@Controller('/event-type')
export class EventTypeController extends CrudController<EventType> {
	constructor(private readonly eventTypeService: EventTypeService, private readonly commandBus: CommandBus) {
		super(eventTypeService);
	}

	/**
	 * GET event types counts
	 *
	 * @param filter
	 * @returns
	 */
	@Get('count')
	@UseValidationPipe({ transform: true })
	async getCount(@Query() options: FindOptionsWhere<EventType>): Promise<number> {
		return this.eventTypeService.countBy(options);
	}

	/**
	 * GET event types pagination
	 *
	 * @param filter
	 * @returns
	 */
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: BaseQueryDTO<EventType>): Promise<IPagination<IEventType>> {
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
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEventType>> {
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
		return this.eventTypeService.findOneByIdString(id, {
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EVENT_TYPES_EDIT)
	@Post()
	async create(@Body() entity: IEventTypeCreateInput): Promise<IEventType> {
		return await this.commandBus.execute(new EventTypeCreateCommand(entity));
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EVENT_TYPES_EDIT)
	@Put(':id')
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: EventType): Promise<IEventType> {
		return this.eventTypeService.create({ ...entity, id });
	}

	/**
	 * DELETE event type by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an inherited handler is
	 * reachable by every member of the tenant until it is gated here (GHSA-v79w-54p2-wmh5).
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
	@Permissions(PermissionsEnum.EVENT_TYPES_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE event type by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate.
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
	@Permissions(PermissionsEnum.EVENT_TYPES_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<EventType> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted event type by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate.
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
	@Permissions(PermissionsEnum.EVENT_TYPES_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<EventType> {
		return super.softRecover(id, ...options);
	}
}
