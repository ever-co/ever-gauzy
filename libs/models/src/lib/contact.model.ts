import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Contact extends IBaseEntityModel {
	businessName?: string;
	firstName?: string;
	lastName?: string;
	address: string;
	contactType: contactType;
	email: string;
	country?: string;
}

export enum contactType {
	Person = 'Person',
	Business = 'Business'
}
