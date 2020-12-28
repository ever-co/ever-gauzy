import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';
import { IOrganizationProject } from './organization-projects.model';
import { ITask } from './task-entity.model';
import { IOrganizationTeam } from './organization-team-model';
import { IKPI } from './goal-settings.model';

export interface IGoal extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description?: string;
	ownerTeam?: IOrganizationTeam;
	ownerEmployee?: IEmployee;
	lead?: IEmployee;
	deadline: string;
	level: string;
	progress: number;
	keyResults?: Array<IKeyResult>;
	alignedKeyResult?: IKeyResult;
}

export interface IKeyResult extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	name: string;
	description?: string;
	type: string;
	unit?: string;
	targetValue?: number;
	initialValue?: number;
	update: number;
	progress: number;
	owner: IEmployee;
	lead?: IEmployee;
	deadline: string;
	hardDeadline?: Date;
	softDeadline?: Date;
	status?: string;
	weight?: string;
	goalId?: string;
	goal?: IGoal;
	project?: IOrganizationProject;
	projectId?: string;
	task?: ITask;
	taskId?: string;
	updates?: Array<IKeyResultUpdate>;
	kpi?: IKPI;
	kpiId?: string;
}

export interface IKeyResultUpdate
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	keyResultId?: string;
	owner: string;
	progress: number;
	update: number;
	status: string;
}

export enum KeyResultNumberUnitsEnum {
	SALES = 'sales',
	VISITORS = 'visitors',
	PEOPLE = 'people',
	ITEMS = 'items',
	CLIENTS = 'clients'
}

export enum KeyResultWeightEnum {
	DEFAULT = '1',
	INCREASE_BY_2X = '2',
	INCREASE_BY_4X = '4'
}

export interface IGoalFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employee?: IEmployeeFindInput;
}

export enum KeyResultTypeEnum {
	NUMERICAL = 'Numerical',
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

export interface IGoalResponse {
	items: IGoal[];
	count: number;
}
