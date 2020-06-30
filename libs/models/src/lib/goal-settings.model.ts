import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface GoalTimeFrame extends IBaseEntityModel {
	name: string;
	status: string;
	startDate: Date;
	endDate: Date;
	organization: Organization;
}

export enum TimeFrameStatusEnum {
	ACTIVE = 'Active',
	INACTIVE = 'Inactive'
}
