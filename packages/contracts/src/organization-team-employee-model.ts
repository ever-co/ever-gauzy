import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeam } from './organization-team-model';
import { IEmployee } from './employee.model';
import { IRole } from './role.model';

export interface IOrganizationTeamEmployee
	extends IBasePerTenantAndOrganizationEntityModel {
	organizationTeamId: string;
	employeeId: string;
	roleId?: string;
	organizationTeam: IOrganizationTeam;
	employee: IEmployee;
	role?: IRole;
}
