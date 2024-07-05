import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

// Define the base interface for shared properties
export interface IBaseUserOrganization extends IBasePerTenantAndOrganizationEntityModel {
	userId?: ID;
	isDefault?: boolean;
}

// Extend the base interface for specific use cases
export interface IUserOrganization extends IBaseUserOrganization {
	user?: IUser;
}

// Use the base interface directly for find input
export interface IUserOrganizationFindInput extends IBaseUserOrganization {}

// Use the base interface directly for create input
export interface IUserOrganizationCreateInput extends IBaseUserOrganization {}
