import { Controller, UseGuards } from '@nestjs/common';
import { TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { CrudController } from '../../core/crud';
import { UserNotificationSetting } from './user-notification-setting.entity';
import { UserNotificationSettingService } from './user-notification-setting.service';

@UseGuards(TenantPermissionGuard)
@Permissions()
@Controller('/user-notification-setting')
export class UserNotificationSettingController extends CrudController<UserNotificationSetting> {
	constructor(readonly userNotificationSettingService: UserNotificationSettingService) {
		super(userNotificationSettingService);
	}
}
