import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects } from '..';

export interface Task extends IBaseEntityModel {
	title: string;
	description?: string;
	status?: string;
	project?: OrganizationProjects;
	projectId?: string;
}
