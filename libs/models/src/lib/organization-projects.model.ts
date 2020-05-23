import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationContacts } from './organization-contacts.model';
import { CurrenciesEnum, ProjectTypeEnum } from './organization.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';

export interface OrganizationProjects extends IBaseEntityWithMembers {
	name: string;
	organizationId: string;
	client?: OrganizationContacts;
	startDate?: Date;
	endDate?: Date;
	type: string;
	currency: string;
	members?: Employee[];
	public: boolean;
}

export interface OrganizationProjectsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	client?: OrganizationContacts;
	members?: Employee[];
	public?: boolean;
}

export interface OrganizationProjectsCreateInput {
	name: string;
	organizationId: string;
	client?: OrganizationContacts;
	startDate?: Date;
	endDate?: Date;
	type?: ProjectTypeEnum;
	currency?: CurrenciesEnum;
	members?: Employee[];
	public?: boolean;
}
