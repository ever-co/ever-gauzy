import { PartialType } from '@nestjs/swagger';
import { IEmployeeNotificationSettingUpdateInput } from '@gauzy/contracts';
import { CreateEmployeeNotificationSettingDTO } from './create-employee-notification-setting.dto';

/**
 * Update EmployeeNotificationSetting validation request DTO
 */
export class UpdateEmployeeNotificationSettingDTO
	extends PartialType(CreateEmployeeNotificationSettingDTO)
	implements IEmployeeNotificationSettingUpdateInput {}
