import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface ITaskStatus extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam {
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

export interface ITaskStatusCreateInput extends Omit<ITaskStatus, 'isSystem'>, Omit<ITaskStatus, 'value'> {}

export interface ITaskStatusUpdateInput extends Partial<ITaskStatusCreateInput> {
	id?: string;
}

export interface ITaskStatusFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITaskStatus, 'projectId' | 'organizationTeamId'> {}

/**
 * Default task statuses
 */
export enum TaskStatusEnum {
	OPEN = 'open',
	IN_PROGRESS = 'in-progress',
	READY_FOR_REVIEW = 'ready-for-review',
	IN_REVIEW = 'in-review',
	BLOCKED = 'blocked',
	COMPLETED = 'completed'
}
