import { Controller, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { CrudController } from '../core/crud';
import { UserNotificationService } from './user-notification.service';
import { UserNotification } from './user-notification.entity';

@UseGuards(TenantPermissionGuard)
@Permissions()
@Controller('/user-notification')
export class UserNotificationController extends CrudController<UserNotification> {
	constructor(readonly userNotificationService: UserNotificationService) {
		super(userNotificationService);
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
