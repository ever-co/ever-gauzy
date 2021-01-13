import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import {
	IOrganizationProject,
	ITag,
	IInvoiceItem,
	IOrganizationSprint
} from '..';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team-model';

export interface ITask extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description?: string;
	status?: string;
	dueDate?: Date;
	estimate?: number;
	project?: IOrganizationProject;
	projectId?: string;
	tags?: ITag[];
	members?: IEmployee[];
	invoiceItems?: IInvoiceItem[];
	teams?: IOrganizationTeam[];
	organizationSprint?: IOrganizationSprint;
	organizationSprintId?: string;
}

export interface IGetTaskOptions
	extends IBasePerTenantAndOrganizationEntityModel {
	projectId?: string;
}
export interface IGetTaskByEmployeeOptions {
	relations?: string[];
	where?: IGetTaskOptions;
}

export interface IGetSprintsOptions
	extends IBasePerTenantAndOrganizationEntityModel {
	projectId?: string;
}

export enum TaskStatusEnum {
	TODO = 'Todo',
	IN_PROGRESS = 'In Progress',
	FOR_TESTING = 'For Testing',
	COMPLETED = 'Completed'
}

export interface ITaskCreateInput extends ITask {
	creatorId?: string;
}
export interface ITaskUpdateInput extends ITaskCreateInput {
	id?: string;
}

export interface ITaskResponse {
	items: ITask[];
	count: number;
}
