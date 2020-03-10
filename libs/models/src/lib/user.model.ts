// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tenant } from './tenant.model';

export interface User extends IBaseEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	startedWorkOn?: string;
	tenant: Tenant;
	empLevel?: string;
}

export interface UserFindInput extends IBaseEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	empLevel?: string;
}

export interface UserRegistrationInput {
	user: User;
	password?: string;
	originalUrl?: string;
	empLevel?: string;
}

export interface UserCreateInput {
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	empLevel?: string;
}
