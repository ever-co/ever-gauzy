import { IStatus } from './status.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITaskPriority extends IStatus {}

export interface ITaskPriorityCreateInput extends Omit<ITaskPriority, 'isSystem'>, Omit<ITaskPriority, 'value'> {}

export interface ITaskPriorityUpdateInput extends ITaskPriorityCreateInput {
	id?: string;
}

export interface ITaskPriorityFindInput extends IBasePerTenantAndOrganizationEntityModel, Pick<ITaskPriority, 'projectId'> {}
