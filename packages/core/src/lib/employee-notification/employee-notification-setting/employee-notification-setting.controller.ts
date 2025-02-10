import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import { CrudController, PaginationParams } from '../../core/crud';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';
import { EmployeeNotificationSettingCreateCommand, EmployeeNotificationSettingUpdateCommand } from './commands';
import { CreateEmployeeNotificationSettingDTO, UpdateEmployeeNotificationSettingDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/employee-notification-setting')
export class EmployeeNotificationSettingController extends CrudController<EmployeeNotificationSetting> {
	constructor(
		readonly employeeNotificationSettingService: EmployeeNotificationSettingService,
		private readonly commandBus: CommandBus
	) {
		super(employeeNotificationSettingService);
	}

	/**
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Get employees notification settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee notification settings',
		type: EmployeeNotificationSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get()
	async findAll(
		@Query() params: PaginationParams<EmployeeNotificationSetting>
	): Promise<IPagination<EmployeeNotificationSetting>> {
		return this.employeeNotificationSettingService.findAll(params);
	}

	/**
	 *
	 * @param id
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee notification setting',
		type: EmployeeNotificationSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<EmployeeNotificationSetting>
	): Promise<EmployeeNotificationSetting> {
		return this.employeeNotificationSettingService.findOneByIdString(id, params);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create employee notification setting.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateEmployeeNotificationSettingDTO): Promise<EmployeeNotificationSetting> {
		return await this.commandBus.execute(new EmployeeNotificationSettingCreateCommand(entity));
	}

	/**
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update employee notification setting.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateEmployeeNotificationSettingDTO
	): Promise<EmployeeNotificationSetting> {
		return await this.commandBus.execute(new EmployeeNotificationSettingUpdateCommand(id, entity));
	}

	/**
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete employee notification setting.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.employeeNotificationSettingService.delete(id);
	}
}
