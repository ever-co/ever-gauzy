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
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import { ITimeSlot, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { TimeSlotService } from './time-slot.service';
import { TimeSlot } from './time-slot.entity';
import { OrganizationPermissionGuard, PermissionGuard, RoleGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { Permissions, Roles } from './../../shared/decorators';
import { DeleteTimeSlotDTO } from './dto';
import { DeleteTimeSlotCommand } from './commands';
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get()
	async findAll(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: TimeSlotQueryDTO
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
	@Post()
	async create(
		@Body() entity: ITimeSlot
	): Promise<ITimeSlot> {
		return this.timeSlotService.create(entity);
	}

	@ApiOperation({ summary: 'Update Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id,
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
	async deleteTimeSlot(
		@Query(new ValidationPipe({
			transform: true
		})) query: DeleteTimeSlotDTO
	): Promise<DeleteResult | UpdateResult> {
		return await this.commandBus.execute(
			new DeleteTimeSlotCommand(query)
		);
	}
}
