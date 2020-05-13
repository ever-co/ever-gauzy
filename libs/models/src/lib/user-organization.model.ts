import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { User, LanguagesEnum } from './user.model';

export interface UserOrganization extends IBaseEntityModel {
	userId: string;
	orgId: string;
	isDefault: boolean;
	isActive: boolean;
	user?: User;
}

export interface UserOrganizationFindInput extends IBaseEntityModel {
	userId?: string;
	orgId?: string;
	isDefault?: boolean;
	isActive?: boolean;
}

export interface UserOrganizationCreateInput {
	userId: string;
	orgId: string;
	isDefault?: boolean;
	isActive?: boolean;
}

export interface UserOrganizationDeleteInput {
	userOrganizationId: string;
	requestingUser: User;
	language?: LanguagesEnum;
}
