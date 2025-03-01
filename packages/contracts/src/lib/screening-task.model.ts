import { IBasePerTenantAndOrganizationEntityModel, ID, OmitFields } from './base-entity.model';
import { IMentionEmployeeIds } from './mention.model';
import { ITask } from './task.model';

export enum ScreeningTaskStatusEnum {
	ACCEPTED = 'accepted',
	DECLINED = 'declined',
	DUPLICATED = 'duplicated',
	SNOOZED = 'snoozed',
	PENDING = 'pending'
}

interface IScreeningTaskBase extends IBasePerTenantAndOrganizationEntityModel {
	status: ScreeningTaskStatusEnum; // Represents the current state or phase of the screening task.
	onHoldUntil?: Date; // The date and time until which the screening task is temporarily paused or put on hold.
}

interface IScreeningTaskAssociations {
	task: ITask;
	taskId: ID;
}

export interface IScreeningTask extends IScreeningTaskBase, IScreeningTaskAssociations {}

export interface IScreeningTaskCreateInput extends OmitFields<IScreeningTask, 'status'>, IMentionEmployeeIds {}

export interface IScreeningTaskUpdateInput extends IScreeningTaskBase {}
