import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface ITaskSize extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam {
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

export interface ITaskSizeCreateInput extends Omit<ITaskSize, 'isSystem'>, Omit<ITaskSize, 'value'> {}

export interface ITaskSizeUpdateInput extends Partial<ITaskSizeCreateInput> {
	id?: string;
}

export interface ITaskSizeFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITaskSize, 'projectId' | 'organizationTeamId'> {}

/**
 * Default task sizes
 */
export enum TaskSizeEnum {
	X_LARGE = 'x-large',
	LARGE = 'large',
	MEDIUM = 'medium',
	SMALL = 'small',
	TINY = 'tiny'
}
