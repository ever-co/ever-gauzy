import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Contact {
	id?: string;
	name?: string;
	firstName?: string;
	lastname?: string;
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

export interface ContactFindInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
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

export interface ContactCreateInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
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
