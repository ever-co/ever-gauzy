import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { LanguagesEnum, User } from './user.model';

export interface UserOrganization extends IBaseEntityModel {
	userId: string;
	organizationId: string;
	isDefault: boolean;
	isActive: boolean;
	user?: User;
	organization?: Organization;
}

export interface UserOrganizationFindInput extends IBaseEntityModel {
	userId?: string;
	organizationId?: string;
	isDefault?: boolean;
	isActive?: boolean;
	organization?: OrganizationFindInput;
}

export interface UserOrganizationCreateInput {
	userId: string;
	organizationId: string;
	isDefault?: boolean;
	isActive?: boolean;
	organization?: Organization;
}

export interface UserOrganizationDeleteInput {
	userOrganizationId: string;
	requestingUser: User;
	language?: LanguagesEnum;
}
