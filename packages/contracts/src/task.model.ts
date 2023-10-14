import {
	IBasePerTenantAndOrganizationEntityModel,
	IBaseRelationsEntityModel,
} from './base-entity.model';
import { IEmployee } from './employee.model';
import { IInvoiceItem } from './invoice-item.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IOrganizationTeam } from './organization-team.model';
import { ITag } from './tag.model';
import { IUser } from './user.model';
import { ITaskStatus, TaskStatusEnum } from './task-status.model';
import { ITaskPriority, TaskPriorityEnum } from './task-priority.model';
import { ITaskSize, TaskSizeEnum } from './task-size.model';

export interface ITask extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	number?: number;
	public?: boolean;
	prefix?: string;
	description?: string;
	status?: TaskStatusEnum;
	priority?: TaskPriorityEnum;
	size?: TaskSizeEnum;
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

	parent?: ITask;
	parentId?: ITask['id']; // Optional field for specifying the parent task ID
	children?: ITask[];

	taskStatus?: ITaskStatus;
	taskSize?: ITaskSize;
	taskPriority?: ITaskPriority;
	taskStatusId?: ITaskStatus['id'];
	taskSizeId?: ITaskSize['id'];
	taskPriorityId?: ITaskPriority['id'];

	rootEpic?: ITask;
}

export interface IGetTaskOptions
	extends IBasePerTenantAndOrganizationEntityModel {
	projectId?: IOrganizationProject['id'];
}

export interface IGetTaskByEmployeeOptions extends IBaseRelationsEntityModel {
	where?: IGetTaskOptions;
}

export type IGetSprintsOptions = IGetTaskOptions;

export enum TaskParticipantEnum {
	EMPLOYEES = 'employees',
	TEAMS = 'teams',
}

export type ITaskCreateInput = ITask;

export interface ITaskUpdateInput extends ITaskCreateInput {
	id?: string;
}

export interface IGetTaskById {
	includeRootEpic?: boolean;
}
