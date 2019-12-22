import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';

export interface OrganizationTeams extends IBaseEntityModel {
	name: string;
	organizationId: string;
	members?: Employee[];
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
