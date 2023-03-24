import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface ITaskPriority extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam {
	name: string;
	value: string;
	description?: string;
	icon?: string;
	color?: string;
	isSystem?: boolean;
	fullIconUrl?: string;
	project?: IOrganizationProject;
	projectId?: IOrganizationProject['id'];
}

export interface ITaskPriorityCreateInput extends Omit<ITaskPriority, 'isSystem'>, Omit<ITaskPriority, 'value'> {}

export interface ITaskPriorityUpdateInput extends Partial<ITaskPriorityCreateInput> {
	id?: string;
}

export interface ITaskPriorityFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITaskPriority, 'projectId' | 'organizationTeamId'> {}

/**
 * Default task priorities
 */
export enum TaskPriorityEnum {
	URGENT = 'urgent',
	HIGH = 'high',
	MEDIUM = 'medium',
	LOW = 'low'
}
