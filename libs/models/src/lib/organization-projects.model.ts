import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationContact } from './organization-contact.model';
import {
	CurrenciesEnum,
	ProjectBillingEnum,
	ProjectOwnerEnum
} from './organization.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Tag } from './tag-entity.model';
import { Task } from './task-entity.model';
import { ITenant } from './tenant.model';
import { OrganizationSprint } from '@gauzy/models';

export interface OrganizationProjects extends IBaseEntityWithMembers {
	name: string;
	organizationId: string;
	organizationContact?: OrganizationContact;
	organizationContactId?: string;
	startDate?: Date;
	endDate?: Date;
	billing: string;
	currency: string;
	members?: Employee[];
	public: boolean;
	tags: Tag[];
	owner: string;
	tasks?: Task[];
	tenant: ITenant;
	organizationSprints?: OrganizationSprint[];
	taskListType: string;
}

export enum TaskListTypeEnum {
	GRID = 'GRID',
	SPRINT = 'SPRINT'
}

export interface OrganizationProjectsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	organizationContactId?: string;
	organizationContact?: OrganizationContact;
	members?: Employee[];
	public?: boolean;
	tags?: Tag[];
}

export interface OrganizationProjectsCreateInput {
	name: string;
	organizationId: string;
	organizationContact?: OrganizationContact;
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: Employee[];
	public?: boolean;
	tags?: Tag[];
	owner?: ProjectOwnerEnum;
}
