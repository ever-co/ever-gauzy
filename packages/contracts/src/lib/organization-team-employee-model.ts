import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IManagerAssignable } from './common.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IEmployeeEntityInput } from './employee.model';
import { IRelationalRole } from './role.model';
import { ITimerStatus } from './timesheet.model';
import { ITask } from './task.model';

// Base interface with common properties
export interface IBaseOrganizationTeamEmployee
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		IManagerAssignable {
	order?: number; // Organization Team Employee Order
	isTrackingEnabled?: boolean; // Enabled/Disabled Time Tracking of the team member
}

// Interface for Organization Team Employee
export interface IOrganizationTeamEmployee
	extends IBaseOrganizationTeamEmployee,
		IEmployeeEntityInput,
		IRelationalRole,
		ITimerStatus {
	activeTaskId?: ID; // Active Task of the team member
	activeTask?: ITask;
}
// Interface for Organization Team Employee Find Input
export interface IOrganizationTeamEmployeeFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		Pick<IBaseOrganizationTeamEmployee, 'isManager' | 'isTrackingEnabled'> {}

// Interface for Organization Team Employee Update Input
export interface IOrganizationTeamEmployeeUpdateInput extends IBaseOrganizationTeamEmployee {}

// Interface for Organization Team Employee Active Task Update Input
export interface IOrganizationTeamEmployeeActiveTaskUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam {
	activeTaskId?: ID;
}
