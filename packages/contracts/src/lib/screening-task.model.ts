import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { ITask } from './task.model';
import { IUser } from './user.model';

export interface IScreeningTask extends IBasePerTenantAndOrganizationEntityModel {
	status: ScreeningTaskStatusEnum;
	taskId: ID;
	task: ITask;
	onHoldUntil?: Date;
	creatorId?: ID;
	creator?: IUser;
}

export enum ScreeningTaskStatusEnum {
	ACCEPTED = 'accepted',
	DECLINED = 'declined',
	DUPLICATED = 'duplicated',
	SNOOZED = 'snoozed',
	PENDING = 'pending'
}
