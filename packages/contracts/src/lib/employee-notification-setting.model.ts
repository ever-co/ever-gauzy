import { IBasePerTenantAndOrganizationEntityModel, JsonData, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

/**
 * Interface for entities that can have employee notification settings.
 */
export interface IEmployeeNotificationSetting extends IEmployeeEntityInput, IBasePerTenantAndOrganizationEntityModel {
	payment?: boolean;
	assignment?: boolean;
	invitation?: boolean;
	mention?: boolean;
	comment?: boolean;
	message?: boolean;
	preferences?: JsonData;
}

/**
 * Input type for creating a new employee notification setting.
 */
export interface IEmployeeNotificationSettingCreateInput extends OmitFields<IEmployeeNotificationSetting> {}

/**
 * Input type for updating an existing employee notification setting.
 */
export interface IEmployeeNotificationSettingUpdateInput
	extends OmitFields<IEmployeeNotificationSetting, 'employeeId' | 'employee'> {}
