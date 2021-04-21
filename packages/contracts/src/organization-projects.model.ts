import { IEmployee } from './employee.model';
import { IOrganizationContact } from './organization-contact.model';
import { ProjectBillingEnum, ProjectOwnerEnum } from './organization.model';
import { IBaseEntityWithMembers } from './entity-with-members.model';
import { ITag } from './tag-entity.model';
import { ITask } from './task-entity.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IPayment } from './payment.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { CurrenciesEnum } from './currency.model';

export interface IOrganizationProject extends IBaseEntityWithMembers {
	name: string;
	organizationContact?: IOrganizationContact;
	organizationContactId?: string;
	startDate?: Date;
	endDate?: Date;
	billing: string;
	currency: string;
	members?: IEmployee[];
	public: boolean;
	tags: ITag[];
	owner: string;
	tasks?: ITask[];
	organizationSprints?: IOrganizationSprint[];
	taskListType: string;
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
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	organizationContactId?: string;
	organizationContact?: IOrganizationContact;
	members?: IEmployee[];
	public?: boolean;
	tags?: ITag[];
	billable?: boolean;
	billingFlat?: boolean;
}

export interface IOrganizationProjectsCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	organizationContact?: IOrganizationContact;
	organizationContactId?: string;
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
}

export interface IOrganizationProjectsUpdateInput
	extends IOrganizationProjectsCreateInput {
	id?: string;
}

export interface IOrganizationProjectStoreState {
	project: IOrganizationProject;
	action: OrganizationProjectAction;
}

export enum OrganizationProjectAction {
	CREATED = 'CREATED',
	UPDATED = 'UPDATED',
	DELETED = 'DELETED'
}

export declare enum SelectedProjectTypeEnum {
	ALL_PROJECT = 'ALL_PROJECT',
	NO_PROJECT = 'NO_PROJECT'
}
