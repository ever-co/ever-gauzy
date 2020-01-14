import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects } from './organization-projects.model';
import { Employee } from './employee.model';

export interface OrganizationClients extends IBaseEntityModel {
	name: string;
	organizationId: string;
	primaryEmail: string;
	emailAddresses?: string[];
	primaryPhone: string;
	phones?: string[];
	country: string;
	street: string;
	city: string;
	zipCode?: number;
	state?: string;
	projects?: OrganizationProjects[];
	notes?: string;
	members?: Employee[];
}

export interface OrganizationClientsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	notes?: string;
}

export interface OrganizationClientsCreateInput {
	name: string;
	organizationId: string;
	primaryEmail: string;
	emailAddresses?: string[];
	primaryPhone: string;
	phones?: string[];
	country: string;
	street: string;
	city: string;
	zipCode?: number;
	state?: string;
	projects?: OrganizationProjects[];
	notes?: string;
}
