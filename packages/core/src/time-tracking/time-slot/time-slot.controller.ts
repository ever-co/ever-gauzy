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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindOneOptions } from 'typeorm';
import { IGetTimeSlotInput, ITimeSlot, OrganizationPermissionsEnum } from '@gauzy/contracts';
import { TimeSlotService } from './time-slot.service';
import { TimeSlot } from './time-slot.entity';
import { OrganizationPermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { Permissions } from './../../shared/decorators';

@ApiTags('TimeSlot')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TimeSlotController {
	constructor(
		private readonly timeSlotService: TimeSlotService
	) {}

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

	@ApiOperation({ summary: 'Get Time Slot By Id' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/:id')
	async getOne(
		@Param('id', UUIDValidationPipe) id: string,
		@Query() option: FindOneOptions
	): Promise<ITimeSlot> {
		return await this.timeSlotService.findOneByIdString(id, option);
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(OrganizationPermissionsEnum.ALLOW_DELETE_TIME)
	@Delete('/')
	async deleteTimeSlot(@Query() { ids }) {
		return this.timeSlotService.deleteTimeSlot(ids);
	}
}
