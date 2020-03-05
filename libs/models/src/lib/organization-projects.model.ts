import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationClients } from './organization-clients.model';
import { CurrenciesEnum, ProjectTypeEnum } from './organization.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';

export interface OrganizationProjects extends IBaseEntityWithMembers {
	name: string;
	// prefix to project tasks / issues, e.g. GA-XXXX (GA is prefix)
	code?: string;
	description?: string;
	// the color of project which is used in UI
	color?: string;
	organizationId: string;
	client?: OrganizationClients;
	startDate?: Date;
	endDate?: Date;
	type: string;
	currency: string;
	members?: Employee[];
	// is project billible?
	billable: boolean;
	// true if the project is flat rate, false if the project is time / materials billable
	billingFlat: boolean;
	public: boolean;
}

export interface OrganizationProjectsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	client?: OrganizationClients;
	members?: Employee[];
	// is project billible?
	billable?: boolean;
	// true if the project is flat rate, false if the project is time / materials billable
	billingFlat?: boolean;
	public?: boolean;
}

export interface OrganizationProjectsCreateInput {
	name: string;
	// prefix to project tasks / issues, e.g. GA-XXXX (GA is prefix)
	code?: string;
	description?: string;
	// the color of project which is used in UI
	color?: string;
	organizationId: string;
	client?: OrganizationClients;
	startDate?: Date;
	endDate?: Date;
	type?: ProjectTypeEnum;
	currency?: CurrenciesEnum;
	members?: Employee[];
	// is project billible?
	billable?: boolean;
	// true if the project is flat rate, false if the project is time / materials billable
	billingFlat?: boolean;
	public?: boolean;
}
