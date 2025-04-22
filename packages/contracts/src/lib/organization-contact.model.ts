import { IOrganizationProject } from './organization-projects.model';
import { IEmployee } from './employee.model';
import { IBaseEntityWithMembers } from './entity-with-members.model';
import { IOrganizationCreateInput } from './organization.model';
import { IUser, LanguagesEnum } from './user.model';
import { ITaggable } from './tag.model';
import { IContact, IContactCreateInput } from './contact.model';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantAndOrganizationEntityMutationInput,
	ID
} from './base-entity.model';
import { ITimeLog } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';

export interface IOrganizationContactEntityMutationInput {
	organizationContactId?: ID;
	organizationContact?: Pick<IOrganizationContact, 'id'>;
}

export interface IRelationalOrganizationContact {
	organizationContact?: IOrganizationContact;
	organizationContactId?: ID;
}

export enum OrganizationContactBudgetTypeEnum {
	HOURS = 'hours',
	COST = 'cost'
}

interface IOrganizationContactAssociations extends ITaggable {
	projects?: IOrganizationProject[];
	members?: IEmployee[];
	timeLogs?: ITimeLog[];
}

export interface IOrganizationContact
	extends IBaseEntityWithMembers,
		IRelationalImageAsset,
		IOrganizationContactAssociations {
	name: string;
	contactType: ContactType;
	primaryEmail: string;
	primaryPhone: string;
	phones?: string[];
	notes?: string;
	imageUrl?: string;
	inviteStatus?: ContactOrganizationInviteStatus;
	contact?: IContact;
	budget?: number;
	budgetType?: OrganizationContactBudgetTypeEnum;
}

export interface IOrganizationContactFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	primaryEmail?: string;
	primaryPhone?: string;
	notes?: string;
	imageUrl?: string;
	contactType?: ContactType;
}

export interface IOrganizationContactCreateInput
	extends IContactCreateInput,
		IBasePerTenantAndOrganizationEntityMutationInput,
		IRelationalImageAsset,
		IOrganizationContactAssociations {
	name: string;
	primaryEmail?: string;
	primaryPhone?: string;
	phones?: string[];
	notes?: string;
	imageUrl?: string;
	contactType?: ContactType;
	contact?: IContactCreateInput;
	contactId?: ID;
}

export interface IOrganizationContactUpdateInput extends IOrganizationContactCreateInput {}

export interface IOrganizationContactInviteInput extends IBasePerTenantAndOrganizationEntityModel {
	languageCode: LanguagesEnum;
	originalUrl?: string;
	inviterUser?: IUser;
}

export interface IOrganizationContactRegistrationInput {
	user: IUser;
	password: string;
	contactOrganization: IOrganizationCreateInput;
}

export interface IOrganizationContactAcceptInviteInput extends IOrganizationContactRegistrationInput {
	inviteId: ID;
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
