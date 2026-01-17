import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationProject } from './organization-projects.model';
import { ITask } from './task.model';
import { IOrganizationTeam } from './organization-team.model';
import { IKPI } from './goal-settings.model';
import { IRelationalOrganizationStrategicInitiative } from './organization-strategic-initiative.model';

export interface IGoal extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationStrategicInitiative {
	name: string;
	description?: string;
	ownerTeam?: IOrganizationTeam;
	ownerTeamId?: ID;
	ownerEmployee?: IEmployee;
	ownerEmployeeId?: ID;
	lead?: IEmployee;
	leadId?: ID;
	deadline: string;
	level: string;
	progress: number;
	keyResults?: Array<IKeyResult>;
	alignedKeyResult?: IKeyResult;
	alignedKeyResultId?: ID;
}

export interface IKeyResult extends IBasePerTenantAndOrganizationEntityModel {
	id?: ID;
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
	goalId?: ID;
	goal?: IGoal;
	project?: IOrganizationProject;
	projectId?: ID;
	task?: ITask;
	taskId?: ID;
	updates?: Array<IKeyResultUpdate>;
	kpi?: IKPI;
	kpiId?: ID;
}

export interface IKeyResultUpdate extends IBasePerTenantAndOrganizationEntityModel {
	id?: ID;
	owner: string;
	progress: number;
	update: number;
	status: string;
	keyResult?: IKeyResult;
	keyResultId?: ID;
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

export interface IGoalFindInput extends IBasePerTenantAndOrganizationEntityModel {
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
