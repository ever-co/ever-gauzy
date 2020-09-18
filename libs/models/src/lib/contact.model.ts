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
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}

export interface IContactFindInput {
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}

export interface IContactCreateInput {
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}
