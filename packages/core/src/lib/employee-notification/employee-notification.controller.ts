import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ID,
	IEmployeeNotification,
	IEmployeeNotificationCreateInput,
	IMarkAllAsReadResponse,
	IPagination
} from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeNotification } from './employee-notification.entity';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/employee-notification')
export class EmployeeNotificationController extends CrudController<EmployeeNotification> {
	constructor(readonly _employeeNotificationService: EmployeeNotificationService) {
		super(_employeeNotificationService);
	}

	/**
	 * Retrieves a paginated list of employee notifications.
	 *
	 * @param {BaseQueryDTO<EmployeeNotification>} params - The query parameters for pagination.
	 * @returns {Promise<IPagination<EmployeeNotification>>} A promise that resolves to the paginated notifications.
	 */
	@ApiOperation({ summary: 'Get employees notifications.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee notifications',
		type: EmployeeNotification
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get('/')
	async findAll(@Query() params: BaseQueryDTO<EmployeeNotification>): Promise<IPagination<IEmployeeNotification>> {
		return this._employeeNotificationService.findAll(params);
	}

	/**
	 * Retrieves an employee notification by its unique identifier.
	 *
	 * @param {ID} id - The UUID of the employee notification.
	 * @param {BaseQueryDTO<EmployeeNotification>} params - Additional query parameters.
	 * @returns {Promise<EmployeeNotification>} A promise that resolves to the found notification.
	 */
	@ApiOperation({ summary: 'Find by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee notification',
		type: EmployeeNotification
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/:id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: BaseQueryDTO<EmployeeNotification>
	): Promise<IEmployeeNotification> {
		return this._employeeNotificationService.findOneByIdString(id, params);
	}

	/**
	 * Files a notification as the caller.
	 *
	 * Overrides the inherited `CrudController.create()` so that the body no longer chooses the sender, the
	 * receiver or the row id. The service pins the sender to the caller's own employee. It allows another
	 * receiver only for a `CHANGE_SELECTED_EMPLOYEE` holder, and only inside the notification's
	 * organization. Notifications the platform raises itself (mentions, assignments, broadcasts) do not use
	 * this route: they are published as events and filed by the event handler, which is unchanged.
	 *
	 * @param entity The notification to file.
	 * @returns The created notification, or nothing when the receiver has switched this kind off.
	 */
	@ApiOperation({ summary: 'Send a notification as the current employee' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Notification created successfully' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'The caller has no employee record, or may not notify that receiver'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(@Body() entity: IEmployeeNotificationCreateInput): Promise<EmployeeNotification> {
		return (await this._employeeNotificationService.createForCaller(entity)) as EmployeeNotification;
	}

	/**
	 * Marks all employee notifications as read.
	 *
	 * @returns {Promise<any>} A promise that resolves to the result of marking notifications as read.
	 */
	@ApiOperation({ summary: 'Mark all notifications as read' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The records have been successfully updated.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/mark-all-read')
	async markAllAsRead(): Promise<IMarkAllAsReadResponse> {
		return await this._employeeNotificationService.markAllAsRead();
	}
}
