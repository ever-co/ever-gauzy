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

export interface IUserOrganizationFindInput {
	id?: string;
	userId?: string;
	organizationId?: string;
	isDefault?: boolean;
	isActive?: boolean;
	organization?: IOrganizationFindInput;
}

export interface IUserOrganizationCreateInput {
	userId: string;
	organizationId: string;
	isDefault?: boolean;
	isActive?: boolean;
	organization?: IOrganization;
}

export interface IUserOrganizationDeleteInput {
	userOrganizationId: string;
	requestingUser: IUser;
	language?: LanguagesEnum;
}
