import {
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantAndOrganizationEntityMutationInput,
	ID
} from './base-entity.model';
import { ICandidate } from './candidate.model';
import { IEmployee } from './employee.model';
import { IOrganizationContact } from './organization-contact.model';

export interface IContactEntityInput {
	contact?: IContact;
	contactId?: ID;
}

export interface IContact extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: string;
	latitude?: number;
	longitude?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
	organization_contacts?: IOrganizationContact[];
	employees?: IEmployee[];
	candidates?: ICandidate[];
}

export interface IContactFindInput extends IContactCreateInput {}

export interface IContactCreateInput extends IBasePerTenantAndOrganizationEntityMutationInput {
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: string;
	latitude?: number;
	longitude?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}
