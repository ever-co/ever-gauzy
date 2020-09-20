import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IOrganizationPosition
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags: ITag[];
}

export interface IOrganizationPositionFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}

export interface IOrganizationPositionCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags: ITag[];
}
