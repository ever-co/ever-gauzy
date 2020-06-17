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
	status?: string;
}

export interface GetKeyResultOptions {
	goalId?: string;
}
