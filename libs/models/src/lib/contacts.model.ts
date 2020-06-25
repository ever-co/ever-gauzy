import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Contacts {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	organizationId?: string;
	// organization?: Organization;
}

export interface ContactsFindInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	organizationId?: string;
	organizationClientId?: string;
}

export interface ContactsCreateInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	organizationId?: string;
	organizationClientId?: string;
}
