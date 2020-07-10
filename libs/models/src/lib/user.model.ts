// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from './tag-entity.model';
import { Employee } from './employee.model';
import { ITenant, Payment } from '@gauzy/models';

export interface User extends IBaseEntityModel {
	thirdPartyId?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	employee?: Employee;
	employeeId?: string;
	tenant: ITenant;
	tags: Tag[];
	preferredLanguage?: string;
	payments?: Payment[];
	paymentsId?: string;
	preferredComponentLayout?: string;
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
	tags?: Tag[];
	preferredLanguage?: LanguagesEnum;
}

export interface UserRegistrationInput {
	user: User;
	password?: string;
	originalUrl?: string;
	organizationId?: string;
	createdById?: string;
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
	tags?: Tag[];
	preferredLanguage?: LanguagesEnum;
	preferredComponentLayout?: ComponentLayoutStyleEnum;
}

export interface UserUpdateInput {
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	preferredLanguage?: LanguagesEnum;
	preferredComponentLayout?: ComponentLayoutStyleEnum;
}

export enum LanguagesEnum {
	ENGLISH = 'en',
	BULGARIAN = 'bg',
	HEBREW = 'he',
	RUSSIAN = 'ru'
}

export enum ComponentLayoutStyleEnum {
	CARDS_GRID = 'CARDS_GRID',
	TABLE = 'TABLE',
	SPRINT_VIEW = 'SPRINT_VIEW'
}
