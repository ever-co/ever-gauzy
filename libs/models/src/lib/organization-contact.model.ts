import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects } from './organization-projects.model';
import { Employee } from './employee.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Organization, OrganizationCreateInput } from './organization.model';
import { User, LanguagesEnum } from './user.model';
import { Tag } from './tag-entity.model';
import { Contact as IContact } from './contact.model';

export interface OrganizationContact extends IContact, IBaseEntityWithMembers {
	name: string;
	contactType: string;
	organizationId: string;
	primaryEmail: string;
	emailAddresses?: string[];
	primaryPhone: string;
	phones?: string[];
	projects?: OrganizationProjects[];
	notes?: string;
	members?: Employee[];
	contactOrganization?: Organization;
	contactOrganizationId?: string;
	inviteStatus?: string;
	tags: Tag[];
	contact: IContact;
}

export interface OrganizationContactFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	notes?: string;
}

export interface OrganizationContactCreateInput
	extends IContact,
		IBaseEntityModel {
	name: string;
	organizationId: string;
	contactId?: string;
	primaryEmail?: string;
	emailAddresses?: string[];
	primaryPhone?: string;
	phones?: string[];
	projects?: OrganizationProjects[];
	notes?: string;
}

export interface OrganizationContactInviteInput extends IBaseEntityModel {
	languageCode: LanguagesEnum;
	originalUrl?: string;
	inviterUser?: User;
}
export interface IOrganizationContactRegistrationInput {
	user: User;
	password: string;
	contactOrganization: OrganizationCreateInput;
}
export interface IOrganizationContactAcceptInviteInput
	extends IOrganizationContactRegistrationInput {
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
