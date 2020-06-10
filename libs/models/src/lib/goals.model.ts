import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Goals extends IBaseEntityModel {
	name: string;
	description?: string;
	owner: string;
	lead: string;
	deadline: string;
	type: string;
	progress: number;
	organizationId: string;
	keyResults?: Array<KeyResult>;
}

export interface KeyResult {
	name: string;
	description?: string;
	type: string;
	targetValue: number;
	initialValue: number;
	update: number | Boolean;
	progress: number;
	owner: string;
	lead: string;
	deadline: string;
	hardDeadline?: Date;
	softDeadline?: Date;
}
