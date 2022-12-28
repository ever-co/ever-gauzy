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
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import { ITimeSlot, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { DeleteTimeSlotCommand } from './commands';
import { TimeSlotService } from './time-slot.service';
import { TimeSlot } from './time-slot.entity';
import { OrganizationPermissionGuard, PermissionGuard, RoleGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { Permissions, Roles } from './../../shared/decorators';
import { DeleteTimeSlotDTO } from './dto';
import { TimeSlotQueryDTO } from './dto/query';

@ApiTags('TimeSlot')
@UseGuards(TenantPermissionGuard, RoleGuard)
@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, RolesEnum.EMPLOYEE)
@Controller()
export class TimeSlotController {
	constructor(
		private readonly timeSlotService: TimeSlotService,
		private readonly commandBus: CommandBus
	) {}

	@ApiOperation({ summary: 'Get Time Slots' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findAll(
		@Query() options: TimeSlotQueryDTO
	): Promise<ITimeSlot[]> {
		return await this.timeSlotService.getTimeSlots(options);
	}

	@ApiOperation({ summary: 'Get Time Slot By Id' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ITimeSlot['id'],
		@Query() options: FindOneOptions
	): Promise<ITimeSlot> {
		return await this.timeSlotService.findOneByIdString(id, options);
	}

	@ApiOperation({ summary: 'Create Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async create(
		@Body() entity: ITimeSlot
	): Promise<ITimeSlot> {
		return await this.timeSlotService.create(entity);
	}

	@ApiOperation({ summary: 'Update Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ITimeSlot['id'],
		@Body() entity: TimeSlot
	): Promise<ITimeSlot> {
		return this.timeSlotService.update(id, entity);
	}

	@ApiOperation({ summary: 'Delete TimeSlot' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The time slot has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard, OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	@Delete()
	@UsePipes(new ValidationPipe({ transform: true }))
	async deleteTimeSlot(
		@Query() query: DeleteTimeSlotDTO
	): Promise<DeleteResult | UpdateResult> {
		return await this.commandBus.execute(
			new DeleteTimeSlotCommand(query)
		);
	}
}
