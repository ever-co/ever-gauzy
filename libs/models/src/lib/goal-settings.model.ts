import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface GoalTimeFrame extends IBaseEntityModel {
	name: string;
	status: string;
	startDate: Date;
	endDate: Date;
}

export enum TimeFrameStatusEnum {
	ACTIVE = 'Active',
	INACTIVE = 'Inactive'
}
