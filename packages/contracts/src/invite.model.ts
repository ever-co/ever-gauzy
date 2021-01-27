// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { IRole } from './role.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUser, IUserRegistrationInput, LanguagesEnum } from './user.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganization } from './organization.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationDepartment } from './organization-department.model';

export interface IInvite extends IBasePerTenantAndOrganizationEntityModel {
	token: string;
	email: string;
	roleId: string;
	invitedById: string;
	status: string;
	expireDate: Date;
	role?: IRole;
	invitedBy?: IUser;
	projects?: IOrganizationProject[];
	organizationContacts?: IOrganizationContact[];
	departments?: IOrganizationDepartment[];
}

export interface IInviteAcceptInput extends IUserRegistrationInput {
	inviteId: string;
	organization: IOrganization;
	originalUrl?: string;
}

export interface IInviteResendInput {
	id: string;
	invitedById: string;
}

export interface ICreateEmailInvitesInput
	extends IBasePerTenantAndOrganizationEntityModel {
	emailIds: string[];
	projectIds?: string[];
	organizationContactIds?: string[];
	departmentIds?: string[];
	roleId: string;
	invitedById: string;
	inviteType: any;
	startedWorkOn: string;
}

export interface ICreateOrganizationContactInviteInput
	extends IBasePerTenantAndOrganizationEntityModel {
	emailId: string;
	organizationContactId: string;
	roleId: string;
	invitedById: string;
	originalUrl: string;
	languageCode: LanguagesEnum;
}

export interface ICreateEmailInvitesOutput {
	items: IInvite[];
	total: number;
	ignored: number;
}

export interface IInviteFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	invitationType?: InvitationTypeEnum;
}

export interface IPublicInviteFindInput {
	email: string;
	token: string;
}

export interface IInviteUpdateInput {
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
export interface IInviteViewModel {
	email: string;
	expireDate: string;
	imageUrl: string;
	fullName: string;
	roleName?: string;
	status: string;
	projectNames: string[];
	clientNames: string[];
	departmentNames: string[];
	id: string;
	inviteUrl: string;
}

export interface IInviteUserModel
	extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	role: string;
	registerUrl: string;
	languageCode: LanguagesEnum;
	invitedBy: IUser;
	originUrl?: string;
}
export interface IInviteEmployeeModel
	extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	registerUrl: string;
	languageCode: LanguagesEnum;
	invitedBy: IUser;
	projects?: IOrganizationProject[];
	organizationContacts?: IOrganizationContact[];
	departments?: IOrganizationDepartment[];
	originUrl?: string;
}
