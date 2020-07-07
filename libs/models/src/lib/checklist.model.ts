import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Checklist extends IBaseEntityModel {
	name: string;
	parentId: string;
	userId: string;
	type: string;
	resolvedCount: number;
	totalCount: number;
	checklistItems?: any[];
}
