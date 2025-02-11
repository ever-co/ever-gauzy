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
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CrudController, PaginationParams } from '../core/crud';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';
import { EmployeeNotificationSettingCreateCommand, EmployeeNotificationSettingUpdateCommand } from './commands';
import { CreateEmployeeNotificationSettingDTO, UpdateEmployeeNotificationSettingDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/employee-notification-setting')
export class EmployeeNotificationSettingController extends CrudController<EmployeeNotificationSetting> {
	constructor(
		protected readonly _employeeNotificationSettingService: EmployeeNotificationSettingService,
		private readonly _commandBus: CommandBus
	) {
		super(_employeeNotificationSettingService);
	}

	/**
	 * Retrieves paginated employee notification settings.
	 *
	 * This endpoint returns a list of employee notification settings based on the provided pagination parameters.
	 * The query parameters are defined by `PaginationParams<EmployeeNotificationSetting>`, and the response is
	 * a paginated object containing employee notification settings.
	 *
	 * @param {PaginationParams<EmployeeNotificationSetting>} params - The pagination and filter parameters.
	 * @returns {Promise<IPagination<EmployeeNotificationSetting>>} A promise that resolves to the paginated employee notification settings.
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
		return this._employeeNotificationSettingService.findAll(params);
	}

	/**
	 * Retrieves a single employee notification setting by its unique identifier.
	 *
	 * @param {ID} id - The UUID of the employee notification setting.
	 * @param {PaginationParams<EmployeeNotificationSetting>} params - Additional query parameters for pagination.
	 * @returns {Promise<EmployeeNotificationSetting>} The employee notification setting if found.
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
		return this._employeeNotificationSettingService.findOneByIdString(id, params);
	}

	/**
	 * Creates a new employee notification setting.
	 *
	 * Accepts a data transfer object containing the necessary details for creating a notification setting,
	 * validates the input, and dispatches a command to persist the new setting.
	 *
	 * @param {CreateEmployeeNotificationSettingDTO} entity - The data for creating the employee notification setting.
	 * @returns {Promise<EmployeeNotificationSetting>} A promise that resolves to the newly created notification setting.
	 */
	@ApiOperation({ summary: 'Create employee notification setting.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateEmployeeNotificationSettingDTO): Promise<EmployeeNotificationSetting> {
		return await this._commandBus.execute(new EmployeeNotificationSettingCreateCommand(entity));
	}

	/**
	 * Updates an existing employee notification setting.
	 *
	 * This endpoint validates the provided ID and update data before dispatching an update command
	 * via the command bus. If the operation is successful, it returns the updated employee notification setting.
	 *
	 * @param {ID} id - The UUID of the employee notification setting to update.
	 * @param {UpdateEmployeeNotificationSettingDTO} entity - The data transfer object containing the update details.
	 * @returns {Promise<EmployeeNotificationSetting>} A promise that resolves to the updated employee notification setting.
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
		return await this._commandBus.execute(new EmployeeNotificationSettingUpdateCommand(id, entity));
	}

	/**
	 * Deletes an employee notification setting by its unique identifier.
	 *
	 * @param {ID} id - The UUID of the employee notification setting to delete.
	 * @returns {Promise<DeleteResult>} A promise that resolves to the result of the delete operation.
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
		return await this._employeeNotificationSettingService.delete(id);
	}
}
