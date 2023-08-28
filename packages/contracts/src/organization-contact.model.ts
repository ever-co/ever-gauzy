import { IOrganizationProject } from './organization-projects.model';
import { IEmployee } from './employee.model';
import { IBaseEntityWithMembers } from './entity-with-members.model';
import { IOrganizationCreateInput } from './organization.model';
import { IUser, LanguagesEnum } from './user.model';
import { ITag } from './tag.model';
import { IContact } from './contact.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITimeLog } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';

export interface IRelationalOrganizationContact {
	organizationContact?: IOrganizationContact;
	organizationContactId?: IOrganizationContact['id'];
}

export interface IOrganizationContact extends IBaseEntityWithMembers, IRelationalImageAsset {
	name: string;
	contactType: ContactType;
	primaryEmail: string;
	primaryPhone: string;
	phones?: string[];
	projects?: IOrganizationProject[];
	notes?: string;
	members?: IEmployee[];
	imageUrl?: string;
	inviteStatus?: ContactOrganizationInviteStatus;
	timeLogs?: ITimeLog[];
	tags: ITag[];
	contact?: IContact;
	createdBy?: string;
	budget?: number;
	budgetType?: OrganizationContactBudgetTypeEnum;
}

export enum OrganizationContactBudgetTypeEnum {
	HOURS = 'hours',
	COST = 'cost'
}

export interface IOrganizationContactFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	notes?: string;
	imageUrl?: string;
	contactType?: ContactType;
	createdBy?: string;
}

export interface IOrganizationContactCreateInput extends IContact, IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset {
	name: string;
	contactId?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	phones?: string[];
	projects?: IOrganizationProject[];
	members?: IEmployee[];
	notes?: string;
	imageUrl?: string;
	contactType?: ContactType;
	createdBy?: string;
}

export interface IOrganizationContactUpdateInput extends IOrganizationContactCreateInput {
	id?: IOrganizationContact['id'];
}

export interface IOrganizationContactInviteInput {
	id: string;
	languageCode: LanguagesEnum;
	originalUrl?: string;
	inviterUser?: IUser;
}

export interface IOrganizationContactRegistrationInput {
	user: IUser;
	password: string;
	contactOrganization: IOrganizationCreateInput;
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
