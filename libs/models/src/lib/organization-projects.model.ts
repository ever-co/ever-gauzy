import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationClients } from './organization-clients.model';
import { CurrenciesEnum, ProjectTypeEnum } from './organization.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Tag } from './tag-entity.model';

export interface OrganizationProjects extends IBaseEntityWithMembers {
	name: string;
	organizationId: string;
	client?: OrganizationClients;
	startDate?: Date;
	endDate?: Date;
	type: string;
	currency: string;
	members?: Employee[];
	public: boolean;
	tags: Tag[];
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
	type?: ProjectTypeEnum;
	currency?: CurrenciesEnum;
	members?: Employee[];
	public?: boolean;
	tags?: Tag[];
}
