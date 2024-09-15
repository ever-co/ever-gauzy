import { IEmployee } from './employee.model';
import { IRelationalOrganizationContact } from './organization-contact.model';
import { ITaggable } from './tag.model';
import { ITask } from './task.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IPayment } from './payment.model';
import { ITimeLog } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';
import { IOrganizationTeam } from './organization-team.model';
import { IOrganizationProjectModule } from './organization-project-module.model';
import { CrudActionEnum, ProjectBillingEnum, ProjectOwnerEnum } from './organization.model';
import { CurrenciesEnum } from './currency.model';
import { TaskStatusEnum } from './task-status.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model'; // Base Entities
import { CustomFieldsObject } from './shared-types'; // Shared Types

// Base interface with optional properties
export interface IRelationalOrganizationProject {
	project?: IOrganizationProject;
	projectId?: ID;
}

// Base interface with optional properties
export interface IOrganizationProjectBase
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalImageAsset,
		IRelationalOrganizationContact,
		IOrganizationProjectSetting,
		ITaggable {
	name?: string;
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: IEmployee[];
	public?: boolean;
	owner?: ProjectOwnerEnum;
	tasks?: ITask[];
	teams?: IOrganizationTeam[];
	timeLogs?: ITimeLog[];
	organizationSprints?: IOrganizationSprint[];
	modules?: IOrganizationProjectModule[];
	taskListType?: TaskListTypeEnum;
	payments?: IPayment[];
	code?: string;
	description?: string;
	color?: string;
	billable?: boolean;
	billingFlat?: boolean;
	openSource?: boolean;
	projectUrl?: string;
	openSourceProjectUrl?: string;
	budget?: number;
	budgetType?: OrganizationProjectBudgetTypeEnum;
	membersCount?: number;
	imageUrl?: string;
	status?: TaskStatusEnum;
	icon?: string;
	archiveTasksIn?: number;
	closeTasksIn?: number;
	defaultAssigneeId?: ID;
	defaultAssignee?: IEmployee;
}

// Base interface with optional properties of organization project setting
export interface IOrganizationProjectSetting extends IBasePerTenantAndOrganizationEntityModel {
	customFields?: CustomFieldsObject;
	isTasksAutoSync?: boolean;
	isTasksAutoSyncOnLabel?: boolean;
	syncTag?: string;
}

export interface IOrganizationProject extends IOrganizationProjectBase {
	name: string; // Make sure these are required
}

export interface IOrganizationProjectsFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationContact {
	name?: string;
	public?: boolean;
	billable?: boolean;
	billingFlat?: boolean;
	organizationTeamId?: ID;
}

export interface IOrganizationProjectCreateInput extends IOrganizationProjectBase {}

export interface IOrganizationProjectUpdateInput extends IOrganizationProjectBase, IOrganizationProjectSetting {}

export interface IOrganizationProjectStoreState {
	project: IOrganizationProject;
	action: CrudActionEnum;
}

// Task List Type Enum
export enum TaskListTypeEnum {
	GRID = 'GRID',
	SPRINT = 'SPRINT'
}

// Organization Project Budget Type Enum
export enum OrganizationProjectBudgetTypeEnum {
	HOURS = 'hours',
	COST = 'cost'
}
