import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';

export interface ITaskSize extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	value: string;
	description?: string;
	icon?: string;
	color?: string;
	isSystem?: boolean;
	project?: IOrganizationProject;
	projectId?: IOrganizationProject['id'];
}

export interface ITaskSizeCreateInput
	extends Omit<ITaskSize, 'isSystem'>,
		Omit<ITaskSize, 'value'> {}

export interface ITaskSizeUpdateInput extends Partial<ITaskSizeCreateInput> {
	id?: string;
}

export interface ITaskSizeFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITaskSize, 'projectId'> {}

/**
 * Default task sizes
 */
export enum TaskSizeEnum {
	X_LARGE = 'x-large',
	LARGE = 'large',
	MEDIUM = 'medium',
	SMALL = 'small',
	TINY = 'tiny',
}
