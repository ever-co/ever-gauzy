// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { User, UserRegistrationInput, LanguagesEnum } from './user.model';
import { OrganizationProjects } from './organization-projects.model';
import { Organization } from './organization.model';
import { OrganizationContact } from './organization-contact.model';
import { OrganizationDepartment } from './organization-department.model';

export interface Invite extends IBaseEntityModel {
	token: string;
	email: string;
	organizationId: string;
	roleId: string;
	invitedById: string;
	status: string;
	expireDate: Date;
	role?: Role;
	invitedBy?: User;
	projects?: OrganizationProjects[];
	organizationContacts?: OrganizationContact[];
	departments?: OrganizationDepartment[];
	organization?: Organization;
}

export interface IInviteAcceptInput extends UserRegistrationInput {
	inviteId: string;
	organization: Organization;
	originalUrl?: string;
}

export interface IInviteResendInput {
	id: string;
	invitedById: string;
}

export interface ICreateEmailInvitesInput {
	emailIds: string[];
	projectIds?: string[];
	organizationContactIds?: string[];
	departmentIds?: string[];
	organizationId: string;
	roleId: string;
	invitedById: string;
	inviteType: any;
	startedWorkOn: string;
}

export interface ICreateOrganizationContactInviteInput {
	emailId: string;
	organizationContactId: string;
	organizationId: string;
	roleId: string;
	invitedById: string;
	originalUrl: string;
	languageCode: LanguagesEnum;
}

export interface ICreateEmailInvitesOutput {
	items: Invite[];
	total: number;
	ignored: number;
}

export interface InviteFindInput {
	organizationId?: string;
	invitationType?: InvitationTypeEnum;
}

export interface PublicInviteFindInput {
	email: string;
	token: string;
}

export interface InviteUpdateInput {
	status: InviteStatusEnum;
}

export enum InviteStatusEnum {
	INVITED = 'INVITED',
	ACCEPTED = 'ACCEPTED'
}

export enum InvitationTypeEnum {
	USER = 'USER',
	EMPLOYEE = 'EMPLOYEE',
	CANDIDATE = 'CANDIDATE'
}
