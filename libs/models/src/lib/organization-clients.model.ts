import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects } from './organization-projects.model';
import { Employee } from './employee.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Organization, OrganizationCreateInput } from './organization.model';
import { User, LanguagesEnum } from './user.model';
import { Tag } from './tag-entity.model';

export interface OrganizationClients extends IBaseEntityWithMembers {
	name: string;
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
	projects?: OrganizationProjects[];
	notes?: string;
	members?: Employee[];
	clientOrganization?: Organization;
	clientOrganizationId?: string;
	inviteStatus?: string;
	tags: Tag[];
}

export interface OrganizationClientsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	country?: string;
	street?: string;
	city?: string;
	zipCode?: number;
	state?: string;
	notes?: string;
}

export interface OrganizationClientsCreateInput extends IBaseEntityModel {
	name: string;
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
	projects?: OrganizationProjects[];
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
