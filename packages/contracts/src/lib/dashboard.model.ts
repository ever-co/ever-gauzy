import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IDashboard extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	code?: string;
	isDefault?: boolean;
	creator?: IUser;
	creatorId?: ID;
}

export interface IDashboardCreateInput extends IDashboard {}
