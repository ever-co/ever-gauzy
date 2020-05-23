import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';

export interface Contact extends IBaseEntityWithMembers {
	businessName?: string;
	firstName?: string;
	lastName?: string;
	address: string;
	contactType: string;
	primaryEmail: string;
	primaryPhone: string;
	country?: string;
}

export enum ContactType {
	Client = 'Client',
	Customer = 'Customer',
	Lead = 'Lead'
}
