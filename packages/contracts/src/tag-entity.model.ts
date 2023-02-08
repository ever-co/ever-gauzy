import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITag extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	color: string;
	description?: string;
	isSystem?: boolean;
}

export interface ITagFindInput extends IBasePerTenantAndOrganizationEntityModel {
	isSystem?: boolean;
	name?: string;
}

export interface ITagCreateInput extends ITag { }

export interface ITagUpdateInput extends Partial<ITagCreateInput> {
	id?: string;
}
