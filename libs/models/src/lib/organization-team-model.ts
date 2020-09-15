import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeamEmployee } from './organization-team-employee-model';
import { ITag } from './tag-entity.model';

export interface IOrganizationTeam
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	tags?: ITag[];
}

export interface IOrganizationTeamFindInput {
	name?: string;
	organizationId?: string;
	tags?: ITag[];
}

export interface IOrganizationTeamCreateInput {
	name: string;
	organizationId: string;
	members?: string[];
	managers?: string[];
	tags?: ITag[];
}
