import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface OrganizationTeams extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface OrganizationTeamsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface OrganizationTeamsCreateInput {
	name: string;
	organizationId: string;
}
