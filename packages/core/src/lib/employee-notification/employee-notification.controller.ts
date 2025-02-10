import { Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CrudController, PaginationParams } from '../core/crud';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeNotification } from './employee-notification.entity';

@UseGuards(TenantPermissionGuard)
@Permissions()
@Controller('/employee-notification')
export class EmployeeNotificationController extends CrudController<EmployeeNotification> {
	constructor(readonly EmployeeNotificationService: EmployeeNotificationService) {
		super(EmployeeNotificationService);
	}

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
	@Get()
	async findAll(@Query() params: PaginationParams<EmployeeNotification>): Promise<IPagination<EmployeeNotification>> {
		return this.EmployeeNotificationService.findAll(params);
	}

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
	@Get(':id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<EmployeeNotification>
	): Promise<EmployeeNotification> {
		return this.EmployeeNotificationService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Mark all notifications as read' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The records have been successfully updated.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/mark-all-read')
	async markAllAsRead(): Promise<any> {
		return await this.EmployeeNotificationService.markAllAsRead();
	}
}
