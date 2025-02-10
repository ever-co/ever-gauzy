import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IEmployeeNotificationSettingCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto/tenant-organization-base.dto';
import { EmployeeNotificationSetting } from '../employee-notification-setting.entity';

/**
 * Create EmployeeNotificationSetting validation request DTO
 */
export class CreateEmployeeNotificationSettingDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(EmployeeNotificationSetting, ['employee', 'employeeId'])
	)
	implements IEmployeeNotificationSettingCreateInput {}
