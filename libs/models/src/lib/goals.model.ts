import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Goal extends IBaseEntityModel {
	name: string;
	description?: string;
	owner: string;
	lead: string;
	deadline: string;
	level: string;
	progress: number;
	organizationId: string;
	keyResults?: Array<KeyResult>;
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
	owner: string;
	lead?: string;
	deadline: string;
	hardDeadline?: Date;
	softDeadline?: Date;
	status?: string;
	goalId?: string;
	goal?: Goal;
	updates?: Array<KeyResultUpdates>;
}

export interface KeyResultUpdates extends IBaseEntityModel {
	id?: string;
	keyResultId?: string;
	owner: string;
	progress: number;
	update: number;
	status: string;
}

export interface GetKeyResultOptions {
	goalId?: string;
}

export enum KeyResultTypeEnum {
	NUMBER = 'Number',
	TRUE_OR_FALSE = 'True/False',
	CURRENCY = 'Currency',
	TASK = 'Task'
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
