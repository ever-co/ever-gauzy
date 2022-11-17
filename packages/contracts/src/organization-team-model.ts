import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeamEmployee } from './organization-team-employee-model';
import { ITag } from './tag-entity.model';
import { ITask } from './task-entity.model';

export interface IOrganizationTeam extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	tags?: ITag[];
	tasks?: ITask[];
}

export interface IOrganizationTeamFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}

export interface IOrganizationTeamCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	memberIds?: string[];
	managerIds?: string[];
	tags?: ITag[];
}

export interface IOrganizationTeamUpdateInput extends Partial<IOrganizationTeamCreateInput> {
	id: string
}
