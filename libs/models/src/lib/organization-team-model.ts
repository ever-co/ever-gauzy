import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
// import { Employee } from './employee.model';
import { OrganizationTeamEmployee } from './organization-team-employee-model';

export interface OrganizationTeam extends IBaseEntityModel {
	name: string;
	organizationId: string;
	members?: OrganizationTeamEmployee[];
}

export interface OrganizationTeamFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface OrganizationTeamCreateInput {
	name: string;
	organizationId: string;
	members?: string[];
}
