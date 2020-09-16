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

export interface IGetTaskOptions {
	projectId?: string;
	organizationId?: string;
}
export interface IGetTaskByEmployeeOptions {
	relations?: string[];
	where?: IGetTaskOptions;
}

export interface IGetSprintsOptions {
	projectId?: string;
	organizationId?: string;
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
