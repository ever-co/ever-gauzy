import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationTeam, Employee, Role, ITenant } from '..';

export interface OrganizationTeamEmployee extends IBaseEntityModel {
	organizationTeamId: string;
	employeeId: string;
	roleId?: string;
	organizationTeam: OrganizationTeam;
	employee: Employee;
	role?: Role;
	organization?: string;
	organizationId?: string;
	tenant: ITenant;
}
