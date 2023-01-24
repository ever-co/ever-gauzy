import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITaskPriority } from './task-priority.model';

export interface ITaskSize extends ITaskPriority {}

export interface ITaskSizeCreateInput extends Omit<ITaskSize, 'isSystem'>, Omit<ITaskSize, 'value'> {}

export interface ITaskSizeUpdateInput extends ITaskSizeCreateInput {
	id?: string;
}

export interface ITaskSizeFindInput extends IBasePerTenantAndOrganizationEntityModel, Pick<ITaskSize, 'projectId'> {}
