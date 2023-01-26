import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';

export interface ITaskPriority extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	value: string;
	description?: string;
	icon?: string;
	color?: string;
	isSystem?: boolean;
	project?: IOrganizationProject;
	projectId?: IOrganizationProject['id'];
}

export interface ITaskPriorityCreateInput extends Omit<ITaskPriority, 'isSystem'>, Omit<ITaskPriority, 'value'> {}

export interface ITaskPriorityUpdateInput extends Partial<ITaskPriorityCreateInput> {
	id?: string;
}

export interface ITaskPriorityFindInput extends IBasePerTenantAndOrganizationEntityModel, Pick<ITaskPriority, 'projectId'> {}

/**
 * Default task priorities
 */
export enum TaskPriorityEnum {
	URGENT = 'urgent',
	HIGH = 'high',
	MEDIUM = 'medium',
	LOW = 'low'
}
