import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects } from './organization-projects.model';
import { Employee } from './employee.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Organization, OrganizationCreateInput } from './organization.model';
import { User, LanguagesEnum } from './user.model';
import { Tag } from './tag-entity.model';

export interface Contacts {
	// export interface Contacts extends IBaseEntityWithMembers {

	name?: string;
	firstName?: string;
	lastname?: string;
	organizationId: string;
	primaryEmail: string;
	emailAddresses?: string[];
	primaryPhone: string;
	phones?: string[];
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	// projects?: OrganizationProjects[];
	// notes?: string;
	// members?: Employee[];
	// clientOrganization?: Organization;
	// clientOrganizationId?: string;
	// inviteStatus?: string;
	// tags: Tag[];
}

export interface ContactsFindInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
	organizationId?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	// notes?: string;
}

export interface ContactsCreateInput extends IBaseEntityModel {
	name?: string;
	firstName?: string;
	lastname?: string;
	organizationId: string;
	primaryEmail?: string;
	emailAddresses?: string[];
	primaryPhone?: string;
	phones?: string[];
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	// projects?: OrganizationProjects[];
	// notes?: string;
}

export interface ContactsInviteInput extends IBaseEntityModel {
	languageCode: LanguagesEnum;
	originalUrl?: string;
	inviterUser?: User;
}
export interface IContactRegistrationInput {
	user: User;
	password: string;
	contactOrganization: OrganizationCreateInput;
}
export interface IOrganizationContactAcceptInviteInput
	extends IContactRegistrationInput {
	inviteId: string;
	originalUrl?: string;
}

export enum ContactOrganizationInviteStatus {
	NOT_INVITED = 'NOT_INVITED',
	INVITED = 'INVITED',
	ACCEPTED = 'ACCEPTED'
}

export enum ContactType {
	CLIENT = 'CLIENT',
	CUSTOMER = 'CUSTOMER',
	LEAD = 'LEAD'
}
