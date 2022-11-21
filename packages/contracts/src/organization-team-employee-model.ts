import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeam } from './organization-team-model';
import { IEmployee } from './employee.model';
import { IRole } from './role.model';
import { ITimerStatus } from './timesheet.model';

export interface IOrganizationTeamEmployee extends IBasePerTenantAndOrganizationEntityModel, ITimerStatus {
	organizationTeam: IOrganizationTeam;
	organizationTeamId: IOrganizationTeam['id'];
	employee: IEmployee;
	employeeId: IEmployee['id'];
	role?: IRole;
	roleId?: IRole['id'];
}

