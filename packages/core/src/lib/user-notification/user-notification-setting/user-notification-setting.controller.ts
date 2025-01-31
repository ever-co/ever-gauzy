import { Controller } from '@nestjs/common';
import { CrudController } from '../../core/crud';
import { UserNotificationSetting } from './user-notification-setting.entity';
import { UserNotificationSettingService } from './user-notification-setting.service';

@Controller('/user-notification-setting')
export class UserNotificationSettingController extends CrudController<UserNotificationSetting> {
	constructor(private readonly userNotificationSettingService: UserNotificationSettingService) {
		super(userNotificationSettingService);
	}
}
