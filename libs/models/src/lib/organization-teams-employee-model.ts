import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationTeams, Employee, Role } from '..';

export interface OrganizationTeamEmployee extends IBaseEntityModel {
	organizationTeamsId: string;
	employeeId: string;
	roleId?: string;
	organizationTeams: OrganizationTeams;
	employee: Employee;
	role?: Role;
}
