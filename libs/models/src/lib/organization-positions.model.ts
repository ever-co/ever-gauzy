import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IOrganizationPositions
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags: ITag[];
}

export interface IOrganizationPositionsFindInput {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationPositionsCreateInput {
	name: string;
	organizationId: string;
	tags: ITag[];
}
