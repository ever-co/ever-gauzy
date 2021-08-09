import { IAvailabilitySlot, IAvailabilitySlotsCreateInput, IPagination } from '@gauzy/contracts';
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
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { AvailabilitySlotsBulkCreateCommand, AvailabilitySlotsCreateCommand } from './commands';

@ApiTags('AvailabilitySlots')
@UseGuards(TenantPermissionGuard)
@Controller()
export class AvailabilitySlotsController extends CrudController<AvailabilitySlot> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly commandBus: CommandBus
	) {
		super(availabilitySlotsService);
	}

	@ApiOperation({ summary: 'Find all availability slots' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found availability slots',
		type: AvailabilitySlot
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IAvailabilitySlot>> {
		const { relations, findInput } = data;
		return this.availabilitySlotsService.findAll({
			where: findInput,
			relations
		});
	}

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
		@Body() entity: IAvailabilitySlot,
		...options: any[]
	): Promise<IAvailabilitySlot> {
		return this.availabilitySlotsService.create({
			id,
			...entity
		});
	}

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
		@Body() entity: IAvailabilitySlotsCreateInput,
		...options: any[]
	): Promise<IAvailabilitySlot> {
		return await this.commandBus.execute(
			new AvailabilitySlotsCreateCommand(entity)
		);
	}

	@ApiOperation({ summary: 'Create slots in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The records have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/bulk')
	async createManyWithEmailsId(
		@Body() entity: IAvailabilitySlotsCreateInput[]
	): Promise<IAvailabilitySlot[]> {
		return await this.commandBus.execute(
			new AvailabilitySlotsBulkCreateCommand(entity)
		);
	}
}
