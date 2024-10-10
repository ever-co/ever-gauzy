import { IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IInvoiceItem } from './invoice-item.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import {
	IOrganizationSprint,
	IRelationalOrganizationSprint,
	IOrganizationSprintTaskHistory
} from './organization-sprint.model';
import { IOrganizationTeam } from './organization-team.model';
import { ITag } from './tag.model';
import { IUser } from './user.model';
import { ITaskStatus, TaskStatusEnum } from './task-status.model';
import { ITaskPriority, TaskPriorityEnum } from './task-priority.model';
import { ITaskSize, TaskSizeEnum } from './task-size.model';
import { IOrganizationProjectModule } from './organization-project-module.model';

export interface ITask
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationProject,
		IRelationalOrganizationSprint {
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
	tags?: ITag[];
	members?: IEmployee[];
	invoiceItems?: IInvoiceItem[];
	teams?: IOrganizationTeam[];
	modules?: IOrganizationProjectModule[];
	taskSprints?: IOrganizationSprint[];
	taskSprintHistories?: IOrganizationSprintTaskHistory[];
	creator?: IUser;
	creatorId?: ID;
	isDraft?: boolean; // Define if task is still draft (E.g : Task description not completed yet)

	parent?: ITask;
	parentId?: ID; // Optional field for specifying the parent task ID
	children?: ITask[];

	taskStatus?: ITaskStatus;
	taskSize?: ITaskSize;
	taskPriority?: ITaskPriority;
	taskStatusId?: ID;
	taskSizeId?: ID;
	taskPriorityId?: ID;

	rootEpic?: ITask;
}

export interface IGetTaskOptions extends IBasePerTenantAndOrganizationEntityModel {
	projectId?: ID;
}

export interface IGetTaskByEmployeeOptions extends IBaseRelationsEntityModel {
	where?: IGetTaskOptions;
}

export type IGetSprintsOptions = IGetTaskOptions;

export enum TaskParticipantEnum {
	EMPLOYEES = 'employees',
	TEAMS = 'teams'
}

export type ITaskCreateInput = ITask;

export interface ITaskUpdateInput extends ITaskCreateInput {
	id?: string;
	taskSprintMoveReason?: string;
}

export interface IGetTaskById {
	includeRootEpic?: boolean;
}
