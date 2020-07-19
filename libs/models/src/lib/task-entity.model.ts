import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects, Tag, InvoiceItem, OrganizationSprint } from '..';
import { Employee } from './employee.model';
import { OrganizationTeam } from './organization-team-model';

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
	invoiceItems?: InvoiceItem[];
	teams?: OrganizationTeam[];
	organizationSprint?: OrganizationSprint;
}

export interface GetTaskOptions {
	projectId?: string;
	organizationId?: string;
}

export interface GetSprintsOptions {
	projectId?: string;
	organizationId?: string;
}

export enum TaskStatusEnum {
	TODO = 'Todo',
	IN_PROGRESS = 'In Progress',
	FOR_TESTING = 'For Testing',
	COMPLETED = 'Completed'
}

export interface ITaskCreateInput extends Task {}
