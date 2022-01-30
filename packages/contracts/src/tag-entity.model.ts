import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITag extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
}

export interface ITagName {
	name?: string;
}

export interface ITagFindInput 
	extends IBasePerTenantAndOrganizationEntityModel {
	isSystem?: boolean
}

export interface ICreateTag extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	color: string;
	description?: string;
}
