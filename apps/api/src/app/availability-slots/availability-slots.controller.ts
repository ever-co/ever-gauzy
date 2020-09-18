import { IAvailabilitySlotsCreateInput } from '@gauzy/models';
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
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { AvailabilitySlotsCreateCommand } from './commands/availability-slots.create.command';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsBulkCreateCommand } from './commands/availability-slots.bulk.create.command';

@ApiTags('AvailabilitySlots')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class AvailabilitySlotsController extends CrudController<
	AvailabilitySlot
> {
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
	async findAllAvailabilitySlots(
		@Query('data') data: string
	): Promise<IPagination<AvailabilitySlot>> {
		const { relations, findInput } = JSON.parse(data);

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
		@Param('id') id: string,
		@Body() entity: AvailabilitySlot,
		...options: any[]
	): Promise<any> {
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
	): Promise<AvailabilitySlot> {
		return this.commandBus.execute(
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
	): Promise<IAvailabilitySlotsCreateInput[]> {
		return this.commandBus.execute(
			new AvailabilitySlotsBulkCreateCommand(entity)
		);
	}
}
