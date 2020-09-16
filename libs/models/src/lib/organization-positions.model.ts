import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IOrganizationPosition
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags: ITag[];
}

export interface IOrganizationPositionFindInput {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationPositionCreateInput {
	name: string;
	organizationId: string;
	tags: ITag[];
}
