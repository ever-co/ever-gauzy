import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationTeamEmployee } from './organization-team-employee-model';
import { Tag } from '..';

export interface OrganizationTeam extends IBaseEntityModel {
	name: string;
	organizationId: string;
	members?: OrganizationTeamEmployee[];
	managers?: OrganizationTeamEmployee[];
	tags?: Tag[];
}

export interface OrganizationTeamFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	tags?: Tag[];
}

export interface OrganizationTeamCreateInput {
	name: string;
	organizationId: string;
	members?: string[];
	managers?: string[];
	tags?: Tag[];
}
