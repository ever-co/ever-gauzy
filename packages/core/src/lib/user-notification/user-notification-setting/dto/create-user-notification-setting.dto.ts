import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IUserNotificationSettingCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { UserNotificationSetting } from '../user-notification-setting.entity';

/**
 * Create UserNotificationSetting validation request DTO
 */
export class CreateUserNotificationSettingDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(UserNotificationSetting, ['user', 'userId']))
	implements IUserNotificationSettingCreateInput {}
