import {
	Controller,
	UseGuards,
	Get,
	Query,
	HttpStatus,
	Delete,
	Param,
	Post,
	Body,
	Put
} from '@nestjs/common';
import { TimeSlot } from '../time-slot.entity';
import { CrudController } from '../../core/crud';
import { TimeSlotService } from './time-slot.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGetTimeSlotInput, ITimeSlot } from '@gauzy/contracts';
import { FindOneOptions } from 'typeorm';
import { TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';

@ApiTags('TimeSlot')
@UseGuards(TenantPermissionGuard)
@Controller('time-slot')
export class TimeSlotController extends CrudController<TimeSlot> {
	constructor(private readonly timeSlotService: TimeSlotService) {
		super(timeSlotService);
	}

	@ApiOperation({ summary: 'Get Time Slots' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getAll(@Query() entity: IGetTimeSlotInput): Promise<ITimeSlot[]> {
		return await this.timeSlotService.getTimeSlots(entity);
	}

	@ApiOperation({ summary: 'Get Time Slots' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/:id')
	async getOne(
		@Param('id', UUIDValidationPipe) { id },
		@Query() option: FindOneOptions
	): Promise<TimeSlot> {
		return await this.timeSlotService.findOne(id, option);
	}

	@ApiOperation({ summary: 'Create Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/')
	async create(@Body() entity: ITimeSlot): Promise<ITimeSlot> {
		return this.timeSlotService.create(entity);
	}

	@ApiOperation({ summary: 'Update Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id,
		@Body() entity: TimeSlot
	): Promise<ITimeSlot> {
		return this.timeSlotService.update(id, entity);
	}

	@ApiOperation({ summary: 'Delete TimeSlot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Delete('/')
	async deleteTimeSlot(@Query() { ids }) {
		return this.timeSlotService.deleteTimeSlot(ids);
	}
}
