import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
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
}
