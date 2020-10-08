import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganization, IOrganizationFindInput } from './organization.model';
import { LanguagesEnum, IUser } from './user.model';

export interface IUserOrganization
	extends IBasePerTenantAndOrganizationEntityModel {
	userId: string;
	isDefault: boolean;
	isActive: boolean;
	user?: IUser;
}

export interface IUserOrganizationFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	userId?: string;
	isDefault?: boolean;
	isActive?: boolean;
}

export interface IUserOrganizationCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	userId: string;
	isDefault?: boolean;
	isActive?: boolean;
}

export interface IUserOrganizationDeleteInput {
	userOrganizationId: string;
	requestingUser: IUser;
	language?: LanguagesEnum;
}
