import {
	IBasePerTenantAndOrganizationEntityModel,
	IBaseRelationsEntityModel,
} from './base-entity.model';
import { IEmployee } from './employee.model';
import { IInvoiceItem } from './invoice-item.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IOrganizationTeam } from './organization-team-model';
import { ITag } from './tag-entity.model';
import { IUser } from './user.model';

export interface ITask extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	number?: number;
	prefix?: string;
	description?: string;
	status?: TaskStatusEnum;
	dueDate?: Date;
	estimate?: number;
	project?: IOrganizationProject;
	projectId?: IOrganizationProject['id'];
	tags?: ITag[];
	members?: IEmployee[];
	invoiceItems?: IInvoiceItem[];
	teams?: IOrganizationTeam[];
	organizationSprint?: IOrganizationSprint;
	organizationSprintId?: IOrganizationSprint['id'];
	creator?: IUser;
	creatorId?: IUser['id'];
}

export interface IGetTaskOptions
	extends IBasePerTenantAndOrganizationEntityModel {
	projectId?: IOrganizationProject['id'];
}

export interface IGetTaskByEmployeeOptions extends IBaseRelationsEntityModel {
	where?: IGetTaskOptions;
}

export interface IGetSprintsOptions extends IGetTaskOptions {}

/**
 * Default task statuses
 */
export enum TaskStatusEnum {
	OPEN = 'open',
	IN_PROGRESS = 'in-progress',
	READY_FOR_REVIEW = 'ready-for-review',
	IN_REVIEW = 'in-review',
	BLOCKED = 'blocked',
	COMPLETED = 'completed',
}

export enum TaskParticipantEnum {
	EMPLOYEES = 'employees',
	TEAMS = 'teams',
}

export interface ITaskCreateInput extends ITask {}

export interface ITaskUpdateInput extends ITaskCreateInput {
	id?: string;
}
