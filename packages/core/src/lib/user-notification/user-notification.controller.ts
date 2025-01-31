import { Controller, UseGuards } from '@nestjs/common';
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
}
