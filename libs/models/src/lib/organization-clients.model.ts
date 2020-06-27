import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects } from './organization-projects.model';
import { Employee } from './employee.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Organization, OrganizationCreateInput } from './organization.model';
import { User, LanguagesEnum } from './user.model';
import { Tag } from './tag-entity.model';
import { Contact } from './contact.model';

export interface OrganizationClients extends Contact, IBaseEntityWithMembers {
	name: string;
	organizationId: string;
	primaryEmail: string;
	emailAddresses?: string[];
	primaryPhone: string;
	phones?: string[];
	projects?: OrganizationProjects[];
	notes?: string;
	members?: Employee[];
	clientOrganization?: Organization;
	clientOrganizationId?: string;
	inviteStatus?: string;
	tags: Tag[];
	contact: Contact;
}

export interface OrganizationClientsFindInput extends Contact, IBaseEntityModel {
	name?: string;
	organizationId?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	notes?: string;
}

export interface OrganizationClientsCreateInput extends Contact, IBaseEntityModel {
	name: string;
	organizationId: string;
	contactId?: string;
	primaryEmail?: string;
	emailAddresses?: string[];
	primaryPhone?: string;
	phones?: string[];
	notes?: string;
}

export interface OrganizationClientsInviteInput extends IBaseEntityModel {
	languageCode: LanguagesEnum;
	originalUrl?: string;
	inviterUser?: User;
}
export interface IOrganizationClientRegistrationInput {
	user: User;
	password: string;
	clientOrganization: OrganizationCreateInput;
}
export interface IOrganizationClientAcceptInviteInput
	extends IOrganizationClientRegistrationInput {
	inviteId: string;
	originalUrl?: string;
}

export enum ClientOrganizationInviteStatus {
	NOT_INVITED = 'NOT_INVITED',
	INVITED = 'INVITED',
	ACCEPTED = 'ACCEPTED'
}

export enum ContactType {
	CLIENT = 'CLIENT',
	CUSTOMER = 'CUSTOMER',
	LEAD = 'LEAD'
}
