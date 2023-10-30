import { IEmployee } from './employee.model';
import { IOrganizationContact, IRelationalOrganizationContact } from './organization-contact.model';
import {
	CrudActionEnum,
	ProjectBillingEnum,
	ProjectOwnerEnum
} from './organization.model';
import { IBaseEntityWithMembers } from './entity-with-members.model';
import { ITag } from './tag.model';
import { ITask } from './task.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IPayment } from './payment.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { CurrenciesEnum } from './currency.model';
import { ITimeLog } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';
import { IOrganizationTeam } from './organization-team.model';
import { IOrganizationGithubRepository } from './github.model';

export interface IRelationalOrganizationProject {
	project?: IOrganizationProject;
	projectId?: IOrganizationProject['id'];
}

export interface IOrganizationProjectSetting extends IBasePerTenantAndOrganizationEntityModel {
	repositoryId?: IOrganizationGithubRepository['id'];
	isTasksAutoSync?: boolean;
	isTasksAutoSyncOnLabel?: boolean;
	syncTag?: string;
}

export interface IOrganizationProject extends IBaseEntityWithMembers, IRelationalImageAsset, IRelationalOrganizationContact, IOrganizationProjectSetting {
	name: string;
	startDate?: Date;
	endDate?: Date;
	billing: ProjectBillingEnum;
	currency: CurrenciesEnum;
	members?: IEmployee[];
	public: boolean;
	tags: ITag[];
	owner: ProjectOwnerEnum;
	tasks?: ITask[];
	teams?: IOrganizationTeam[];
	timeLogs?: ITimeLog[];
	organizationSprints?: IOrganizationSprint[];
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
	/** Project Sync With Repository */
	repository?: IOrganizationGithubRepository;
	repositoryId?: IOrganizationGithubRepository['id'];
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
	organizationTeamId?: IOrganizationTeam['id'];
	organizationContactId?: IOrganizationContact['id'];
	organizationContact?: IOrganizationContact;
	public?: boolean;
	billable?: boolean;
	billingFlat?: boolean;
}

export interface IOrganizationProjectCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset {
	name?: string;
	organizationContact?: IOrganizationContact;
	organizationContactId?: IOrganizationContact['id'];
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: IEmployee[];
	public?: boolean;
	tags?: ITag[];
	owner?: ProjectOwnerEnum;
	code?: string;
	description?: string;
	color?: string;
	billable?: boolean;
	billingFlat?: boolean;
	status?: string;
	openSource?: boolean;
	projectUrl?: string;
	openSourceProjectUrl?: string;
	taskListType?: TaskListTypeEnum;
}

export interface IOrganizationProjectUpdateInput extends IOrganizationProjectCreateInput, IOrganizationProjectSetting {
	id?: IOrganizationContact['id'];

}

export interface IOrganizationProjectStoreState {
	project: IOrganizationProject;
	action: CrudActionEnum;
}
