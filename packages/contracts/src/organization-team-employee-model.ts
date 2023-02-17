import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalOrganizationTeam } from './organization-team-model';
import { IRelationalEmployee } from './employee.model';
import { IRelationalRole } from './role.model';
import { ITimerStatus } from './timesheet.model';

export interface IOrganizationTeamEmployee extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam, IRelationalEmployee, IRelationalRole, ITimerStatus {
	isTrackingEnabled?: boolean;
}

export interface IOrganizationTeamEmployeeFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam { }

export interface IOrganizationTeamEmployeeUpdateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam {
	isTrackingEnabled?: boolean;
}
