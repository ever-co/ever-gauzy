import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IUser } from './user.model';

export interface IUserNotificationSetting extends IBasePerTenantAndOrganizationEntityModel {
	userId: ID;
	user?: IUser;
	payment?: boolean;
	assignment?: boolean;
	invitation?: boolean;
	mention?: boolean;
	comment?: boolean;
	message?: boolean;
	preferences?: JsonData;
}

export interface IUserNotificationSettingCreateInput extends Omit<IUserNotificationSetting, 'user' | 'userId'> {}

export interface IUserNotificationSettingUpdateInput
	extends Omit<IUserNotificationSettingCreateInput, 'userId' | 'user'> {}
