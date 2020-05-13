import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects, Tag } from '..';
import { Employee } from './employee.model';

export interface Task extends IBaseEntityModel {
	title: string;
	description?: string;
	status?: string;
	dueDate?: Date;
	estimate?: number;
	project?: OrganizationProjects;
	projectId?: string;
	tags?: Tag[];
	members?: Employee[];
}

export interface GetTaskOptions {
	projectId?: string;
	organizationId?: string;
}

export interface ITaskCreateInput extends Task {}
