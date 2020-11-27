import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IContact extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: number;
	latitude?: number;
	longitude?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}

export interface IContactFindInput extends IContactCreateInput {
	id?: string;
}

export interface IContactCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: number;
	latitude?: number;
	longitude?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}
