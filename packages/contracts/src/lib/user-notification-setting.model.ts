import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IUser } from './user.model';

export interface IUserNotificationSetting extends IBasePerTenantAndOrganizationEntityModel {
	payment?: boolean;
	assignment?: boolean;
	invitation?: boolean;
	mention?: boolean;
	comment?: boolean;
	message?: boolean;
	preferences?: JsonData;
	userId: ID;
	user?: IUser;
}
