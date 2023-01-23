import { IStatus } from './status.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IPriority extends IStatus {}

export interface IPriorityCreateInput extends Omit<IPriority, 'isSystem'>, Omit<IPriority, 'value'> {}

export interface IPriorityUpdateInput extends IPriorityCreateInput {
	id?: string;
}

export interface IPriorityFindInput extends IBasePerTenantAndOrganizationEntityModel, Pick<IPriority, 'projectId'> {}
