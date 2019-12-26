// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { User } from './user.model';
import { OrganizationProjects } from './organization-projects.model';

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
}

export interface CreateEmailInvitesInput {
	emailIds: string[];
	projectIds?: string[];
	organizationId: string;
	roleId: string;
	invitedById: string;
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

export enum InviteStatusEnum {
	INVITED = 'INVITED',
	EXPECTED = 'EXPECTED',
	EXPIRED = 'EXPIRED'
}

export enum InvitationTypeEnum {
	USER = 'USER',
	EMPLOYEE = 'EMPLOYEE'
}

// export interface UserFindInput extends IBaseEntityModel {
// 	thirdPartyId?: string;
// 	firstName?: string;
// 	lastName?: string;
// 	email?: string;
// 	username?: string;
// 	role?: Role;
// 	roleId?: string;
// 	hash?: string;
// 	imageUrl?: string;
// }

// export interface UserRegistrationInput {
// 	user: User;
// 	password?: string;
// }

// export interface UserCreateInput {
// 	firstName?: string;
// 	lastName?: string;
// 	email?: string;
// 	username?: string;
// 	role?: Role;
// 	roleId?: string;
// 	hash?: string;
// 	imageUrl?: string;
// }
