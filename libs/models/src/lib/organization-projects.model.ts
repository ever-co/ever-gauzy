import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationClients } from './organization-clients.model';
import {
	CurrenciesEnum,
	ProjectBillingEnum,
	ProjectOwnerEnum
} from './organization.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Tag } from './tag-entity.model';

export interface OrganizationProjects extends IBaseEntityWithMembers {
	name: string;
	organizationId: string;
	client?: OrganizationClients;
	startDate?: Date;
	endDate?: Date;
	billing: string;
	currency: string;
	members?: Employee[];
	public: boolean;
	tags: Tag[];
	owner: string;
}

export interface OrganizationProjectsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	client?: OrganizationClients;
	members?: Employee[];
	public?: boolean;
	tags?: Tag[];
}

export interface OrganizationProjectsCreateInput {
	name: string;
	organizationId: string;
	client?: OrganizationClients;
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: Employee[];
	public?: boolean;
	tags?: Tag[];
	owner?: ProjectOwnerEnum;
}
