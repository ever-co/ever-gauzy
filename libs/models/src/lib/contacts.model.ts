import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Contact {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
}

export interface ContactFindInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
}

export interface ContactCreateInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
}
