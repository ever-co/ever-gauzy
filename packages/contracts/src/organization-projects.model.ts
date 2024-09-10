import { IEmployee } from './employee.model';
import { IRelationalOrganizationContact } from './organization-contact.model';
import { CrudActionEnum, ProjectBillingEnum, ProjectOwnerEnum } from './organization.model';
import { ITaggable } from './tag.model';
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
		IOrganizationProjectSetting,
		ITaggable {
	name: string;
	startDate?: Date;
	endDate?: Date;
	billing: ProjectBillingEnum;
	currency: CurrenciesEnum;
	members?: IEmployee[];
	public: boolean;
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
	status?: TaskStatusEnum;
	icon?: string;
	archiveTasksIn?: number;
	closeTasksIn?: number;
	defaultAssigneeId?: ID;
	defaultAssignee?: IEmployee;
}

export enum TaskListTypeEnum {
	GRID = 'GRID',
	SPRINT = 'SPRINT'
}

export enum OrganizationProjectBudgetTypeEnum {
	HOURS = 'hours',
	COST = 'cost'
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

export interface IOrganizationProjectCreateInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalImageAsset,
		IRelationalOrganizationContact,
		ITaggable {
	name?: string;
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: IEmployee[];
	public?: boolean;
	owner?: ProjectOwnerEnum;
	code?: string;
	description?: string;
	color?: string;
	billable?: boolean;
	billingFlat?: boolean;
	openSource?: boolean;
	projectUrl?: string;
	openSourceProjectUrl?: string;
	taskListType?: TaskListTypeEnum;
	status?: TaskStatusEnum;
	icon?: string;
	archiveTasksIn?: number;
	closeTasksIn?: number;
	defaultAssigneeId?: ID;
	defaultAssignee?: IEmployee;
}

export interface IOrganizationProjectUpdateInput extends IOrganizationProjectCreateInput, IOrganizationProjectSetting {}

export interface IOrganizationProjectStoreState {
	project: IOrganizationProject;
	action: CrudActionEnum;
}
