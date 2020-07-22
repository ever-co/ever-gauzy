import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { OrganizationFindInput, Organization } from './organization.model';
import { OrganizationProjects } from './organization-projects.model';
import { Task } from './task-entity.model';
import { OrganizationTeam } from './organization-team-model';
import { KPI } from './goal-settings.model';

export interface Goal extends IBaseEntityModel {
	name: string;
	description?: string;
	ownerOrg?: Organization;
	ownerTeam?: OrganizationTeam;
	ownerEmployee?: Employee;
	lead?: Employee;
	deadline: string;
	level: string;
	progress: number;
	organizationId: string;
	keyResults?: Array<KeyResult>;
	alignedKeyResult?: KeyResult;
}

export interface KeyResult extends IBaseEntityModel {
	id?: string;
	name: string;
	description?: string;
	type: string;
	targetValue?: number;
	initialValue?: number;
	update: number;
	progress: number;
	owner: Employee;
	lead?: Employee;
	deadline: string;
	hardDeadline?: Date;
	softDeadline?: Date;
	status?: string;
	weight?: string;
	goalId?: string;
	goal?: Goal;
	project?: OrganizationProjects;
	projectId?: string;
	task?: Task;
	taskId?: string;
	updates?: Array<KeyResultUpdates>;
	kpi?: KPI;
	kpiId?: string;
}

export interface KeyResultUpdates extends IBaseEntityModel {
	id?: string;
	keyResultId?: string;
	owner: string;
	progress: number;
	update: number;
	status: string;
}

export enum KeyResultWeightEnum {
	DEFAULT = '1',
	INCREASE_BY_2X = '2',
	INCREASE_BY_4X = '4'
}

export interface GoalFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
}

export enum KeyResultTypeEnum {
	NUMBER = 'Number',
	TRUE_OR_FALSE = 'True/False',
	CURRENCY = 'Currency',
	TASK = 'Task',
	KPI = 'KPI'
}

export enum KeyResultDeadlineEnum {
	NO_CUSTOM_DEADLINE = 'No Custom Deadline',
	HARD_DEADLINE = 'Hard Deadline',
	HARD_AND_SOFT_DEADLINE = 'Hard and Soft Deadline'
}

export enum GoalLevelEnum {
	ORGANIZATION = 'Organization',
	TEAM = 'Team',
	EMPLOYEE = 'Employee'
}

export enum KeyResultUpdateStatusEnum {
	ON_TRACK = 'on track',
	NEEDS_ATTENTION = 'needs attention',
	OFF_TRACK = 'off track',
	NONE = 'none'
}
