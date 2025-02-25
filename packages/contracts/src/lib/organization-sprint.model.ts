import { IOrganizationProjectModule } from './organization-project-module.model';
import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { ITask } from './task.model';
import { IEmployeeEntityInput, IMemberEntityBased } from './employee.model';
import { IRelationalRole } from './role.model';
import { IUser } from './user.model';
import { IManagerAssignable } from './common.model';

// Base interface with optional properties
export interface IRelationalOrganizationSprint {
	organizationSprint?: IOrganizationSprint;
	organizationSprintId?: ID;
}

export interface IOrganizationSprintBase extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	goal?: string;
	length?: number; // Duration of Sprint. Default value - 7 (days)
	startDate?: Date;
	endDate?: Date;
	status?: OrganizationSprintStatusEnum;
	dayStart?: number; // Enum ((Sunday-Saturday) => (0-7))
	sprintProgress?: JsonData; // Stores the current state and metrics of the sprint's progress
	project?: IOrganizationProject;
	projectId?: ID;
	tasks?: ITask[];
	members?: IOrganizationSprintEmployee[];
	modules?: IOrganizationProjectModule[];
	taskSprints?: IOrganizationSprintTask[];
	fromSprintTaskHistories?: IOrganizationSprintTaskHistory[];
	toSprintTaskHistories?: IOrganizationSprintTaskHistory[];
}

export interface IOrganizationSprint extends IOrganizationSprintBase {
	name: string;
	length: number;
	project: IOrganizationProject;
	projectId: ID;
}

export interface IOrganizationSprintCreateInput extends IOrganizationSprintBase, IMemberEntityBased {}

export enum SprintStartDayEnum {
	SUNDAY = 1,
	MONDAY = 2,
	TUESDAY = 3,
	WEDNESDAY = 4,
	THURSDAY = 5,
	FRIDAY = 6,
	SATURDAY = 7
}

export enum OrganizationSprintStatusEnum {
	ACTIVE = 'active',
	COMPLETED = 'completed',
	DRAFT = 'draft',
	UPCOMING = 'upcoming'
}

export interface IOrganizationSprintUpdateInput extends IOrganizationSprintCreateInput {}

export interface IOrganizationSprintEmployee
	extends IBasePerTenantAndOrganizationEntityModel,
		IEmployeeEntityInput,
		IRelationalRole,
		IManagerAssignable {
	organizationSprint: IOrganizationSprint;
	organizationSprintId: ID;
}

export interface IOrganizationSprintTask extends IBasePerTenantAndOrganizationEntityModel {
	organizationSprint: IOrganizationSprint;
	organizationSprintId: ID;
	task?: ITask;
	taskId: ID;
	totalWorkedHours?: number;
}

export interface IOrganizationSprintTaskHistory extends IBasePerTenantAndOrganizationEntityModel {
	reason?: string;
	task?: ITask;
	taskId?: ID;
	fromSprint?: IOrganizationSprint;
	fromSprintId?: ID;
	toSprint?: IOrganizationSprint;
	toSprintId?: ID;
	movedBy?: IUser;
	movedById?: ID;
}
