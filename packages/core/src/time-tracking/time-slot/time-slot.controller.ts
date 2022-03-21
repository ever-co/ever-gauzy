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
	Put,
	UsePipes,
	ValidationPipe,
	UseInterceptors
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';
import { IGetTimeSlotInput, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { TimeSlotService } from './time-slot.service';
import { TimeSlot } from './time-slot.entity';
import { OrganizationPermissionGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { Permissions } from './../../shared/decorators';
import { DeleteTimeSlotDTO } from './dto';
import { DeleteTimeSlotCommand } from './commands';
import { TransformInterceptor } from './../../core/interceptors';

@ApiTags('TimeSlot')
@UseGuards(TenantPermissionGuard)
@UseInterceptors(TransformInterceptor)
@Controller()
export class TimeSlotController {
	constructor(
		private readonly timeSlotService: TimeSlotService,
		private readonly commandBus: CommandBus
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
	@UseGuards(PermissionGuard, OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	@UsePipes(new ValidationPipe({ transform: true }))
	@Delete('/')
	async deleteTimeSlot(
		@Query() query: DeleteTimeSlotDTO
	) {
		return await this.commandBus.execute(
			new DeleteTimeSlotCommand(query)
		);
	}
}
