// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { User, UserRegistrationInput } from './user.model';
import { OrganizationProjects } from './organization-projects.model';
import { Organization } from './organization.model';
import { OrganizationClients } from './organization-clients.model';
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
	clients?: OrganizationClients[];
	departments?: OrganizationDepartment[];
	organization?: Organization;
}

export interface InviteAcceptInput extends UserRegistrationInput {
	inviteId: string;
	organization: Organization;
}

export interface InviteResendInput {
	id: string;
	invitedById: string;
}

export interface CreateEmailInvitesInput {
	emailIds: string[];
	projectIds?: string[];
	clientIds?: string[];
	departmentIds?: string[];
	organizationId: string;
	roleId: string;
	invitedById: string;
	inviteType: any;
	startedWorkOn: string;
}

export interface CreateOrganizationClientInviteInput {
	emailId: string;
	clientId: string;
	organizationId: string;
	roleId: string;
	invitedById: string;
	originalUrl: string;
}

export interface CreateEmailInvitesOutput {
	items: Invite[];
	total: number;
	ignored: number;
}

export interface CreateInviteInput {
	token: string;
	email: string;
	organizationId: string;
	roleId: string;
	invitedById: string;
	status: string;
	expireDate: Date;
	projects?: OrganizationProjects[];
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
