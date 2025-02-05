import { Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CrudController, PaginationParams } from '../core/crud';
import { UserNotificationService } from './user-notification.service';
import { UserNotification } from './user-notification.entity';

@UseGuards(TenantPermissionGuard)
@Permissions()
@Controller('/user-notification')
export class UserNotificationController extends CrudController<UserNotification> {
	constructor(readonly userNotificationService: UserNotificationService) {
		super(userNotificationService);
	}

	@ApiOperation({ summary: 'Get users notifications.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found user notifications',
		type: UserNotification
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get()
	async findAll(@Query() params: PaginationParams<UserNotification>): Promise<IPagination<UserNotification>> {
		return this.userNotificationService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found user notification',
		type: UserNotification
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<UserNotification>
	): Promise<UserNotification> {
		return this.userNotificationService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Mark all notifications as read' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The records have been successfully updated.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/mark-all-read')
	async markAllAsRead(): Promise<any> {
		return await this.userNotificationService.markAllAsRead();
	}
}
