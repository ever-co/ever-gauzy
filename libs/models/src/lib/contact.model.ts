import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Contact {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: number;
	regionCode?: string;
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
}
