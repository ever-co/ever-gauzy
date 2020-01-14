import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationClients } from './organization-clients.model';
import { CurrenciesEnum, ProjectTypeEnum } from './organization.model';

export interface OrganizationProjects extends IBaseEntityModel {
	name: string;
	organizationId: string;
	client?: OrganizationClients;
	startDate?: Date;
	endDate?: Date;
	type: string;
	currency: string;
	members?: Employee[];
}

export interface OrganizationProjectsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	client?: OrganizationClients;
	members?: Employee[];
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
}
