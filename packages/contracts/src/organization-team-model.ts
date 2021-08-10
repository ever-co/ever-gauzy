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

export interface IOrganizationTeamFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	tags?: ITag[];
}

export interface IOrganizationTeamCreateInput 
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	members?: string[];
	managers?: string[];
	tags?: ITag[];
}
