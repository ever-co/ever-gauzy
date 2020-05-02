import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationTeam, Employee, Role } from '..';

export interface OrganizationTeamEmployee extends IBaseEntityModel {
	organizationTeamId: string;
	employeeId: string;
	roleId?: string;
	organizationTeam: OrganizationTeam;
	employee: Employee;
	role?: Role;
}
