import { OmitType, PartialType } from '@nestjs/swagger';
import { IUserNotificationSettingUpdateInput } from '@gauzy/contracts';
import { CreateUserNotificationSettingDTO } from './create-user-notification-setting.dto';

/**
 * Update UserNotificationSetting validation request DTO
 */
export class UpdateUserNotificationSettingDTO
	extends PartialType(OmitType(CreateUserNotificationSettingDTO, ['user', 'userId']))
	implements IUserNotificationSettingUpdateInput {}
