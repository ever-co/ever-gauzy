import { IEmployee } from './employee.model';
import { IOrganizationContact, IRelationalOrganizationContact } from './organization-contact.model';
import { CrudActionEnum, ProjectBillingEnum, ProjectOwnerEnum } from './organization.model';
import { ITag } from './tag.model';
import { ITask } from './task.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IPayment } from './payment.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { CurrenciesEnum } from './currency.model';
import { ITimeLog } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';
import { IOrganizationTeam } from './organization-team.model';
import { CustomFieldsObject } from './shared-types';
import { IOrganizationProjectModule } from './organization-project-module.model';
import { TaskStatusEnum } from './task-status.model';

export interface IRelationalOrganizationProject {
	project?: IOrganizationProject;
	projectId?: ID;
}

export interface IOrganizationProjectSetting extends IBasePerTenantAndOrganizationEntityModel {
	customFields?: CustomFieldsObject;
	isTasksAutoSync?: boolean;
	isTasksAutoSyncOnLabel?: boolean;
	syncTag?: string;
}

export interface IOrganizationProject
	extends IRelationalImageAsset,
		IRelationalOrganizationContact,
		IOrganizationProjectSetting {
	name: string;
	startDate?: Date;
	endDate?: Date;
	billing: ProjectBillingEnum;
	currency: CurrenciesEnum;
	members?: IEmployee[];
	public: boolean;
	status?: TaskStatusEnum; // Defines the project stage / progession / step
	tags: ITag[];
	owner: ProjectOwnerEnum;
	tasks?: ITask[];
	teams?: IOrganizationTeam[];
	timeLogs?: ITimeLog[];
	organizationSprints?: IOrganizationSprint[];
	modules?: IOrganizationProjectModule[];
	taskListType: TaskListTypeEnum;
	payments?: IPayment[];
	// prefix to project tasks / issues, e.g. GA-XXXX (GA is prefix)
	code?: string;
	description?: string;
	// the color of project which is used in UI
	color?: string;
	// The project icon used on UI
	icon?: string;
	// is project billable?
	billable?: boolean;
	// true if the project is flat rate, false if the project is time / materials billable
	billingFlat?: boolean;
	openSource?: boolean;
	projectUrl?: string;
	openSourceProjectUrl?: string;
	budget?: number;
	budgetType?: OrganizationProjectBudgetTypeEnum;
	membersCount?: number;
	imageUrl?: string;
	// Project manager
	manager?: IEmployee;
	managerId?: ID;
	// Default project assignee
	defaultAssignee?: IEmployee;
	defaultAssigneeId?: ID;
	// automations
	archiveTasksIn?: number; // Expressed in months, all completed (done) and canceled tasks related to the project will be auto-archived after the period reached
	closeTasksIn?: number; // Expressed in months, all completed (done) and canceled tasks related to the project will be auto-closed after the period reached
}

export enum TaskListTypeEnum {
	GRID = 'GRID',
	SPRINT = 'SPRINT'
}

export enum OrganizationProjectBudgetTypeEnum {
	HOURS = 'hours',
	COST = 'cost'
}

export interface IOrganizationProjectsFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	organizationTeamId?: ID;
	organizationContactId?: ID;
	organizationContact?: IOrganizationContact;
	public?: boolean;
	billable?: boolean;
	billingFlat?: boolean;
}

export interface IOrganizationProjectCreateInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalImageAsset {
	name?: string;
	organizationContact?: IOrganizationContact;
	organizationContactId?: ID;
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: IEmployee[];
	public?: boolean;
	icon?: string;
	tags?: ITag[];
	owner?: ProjectOwnerEnum;
	code?: string;
	description?: string;
	color?: string;
	billable?: boolean;
	billingFlat?: boolean;
	status?: TaskStatusEnum;
	openSource?: boolean;
	projectUrl?: string;
	openSourceProjectUrl?: string;
	taskListType?: TaskListTypeEnum;
	manager?: IEmployee;
	managerId?: ID;
	defaultAssignee?: IEmployee;
	defaultAssigneeId?: ID;
	archiveTasksIn?: number;
	closeTasksIn?: number;
}

export interface IOrganizationProjectUpdateInput extends IOrganizationProjectCreateInput, IOrganizationProjectSetting {
	id?: ID;
}

export interface IOrganizationProjectStoreState {
	project: IOrganizationProject;
	action: CrudActionEnum;
}
