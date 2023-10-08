import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IRelationalEmployee } from './employee.model';
import { IRelationalRole } from './role.model';
import { ITimerStatus } from './timesheet.model';
import { ITask } from './task.model';

export interface IOrganizationTeamEmployee
	extends IBasePerTenantAndOrganizationEntityModel,
	IRelationalOrganizationTeam,
	IRelationalEmployee,
	IRelationalRole,
	ITimerStatus {
	isTrackingEnabled?: boolean;
	activeTaskId?: ITask['id'];
	activeTask?: ITask;
}

export interface IOrganizationTeamEmployeeFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
	IRelationalOrganizationTeam { }

export interface IOrganizationTeamEmployeeUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel,
	IRelationalOrganizationTeam {
	isTrackingEnabled?: boolean;
}

export interface IOrganizationTeamEmployeeActiveTaskUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel,
	IRelationalOrganizationTeam {
	activeTaskId?: ITask['id'];
}
