// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { IRole } from './role.model';
import { IBasePerTenantEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';
import { IEmployee } from './employee.model';
import { IPayment } from './payment.model';
import { IOrganization } from './organization.model';
import { IInvite } from './invite.model';
import { ICandidate } from 'candidate.model';

export interface IUser extends IBasePerTenantEntityModel {
	thirdPartyId?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: IRole;
	roleId?: IRole['id'];
	hash?: string;
	imageUrl?: string;
	employee?: IEmployee;
	employeeId?: IEmployee['id'];
	candidate?: ICandidate;
	candidateId?: ICandidate['id'];
	tags?: ITag[];
	preferredLanguage?: string;
	payments?: IPayment[];
	preferredComponentLayout?: ComponentLayoutStyleEnum;
	fullName?: string;
	organizations?: IOrganization[];
	isImporting?: boolean;
	sourceId?: string;
	isActive?: boolean;
	code?: number;
	codeExpireAt?: Date;
	emailVerifiedAt?: Date;
	emailToken?: string;
	invites?: IInvite[];
}

export interface IUserFindInput extends IBasePerTenantEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: IRole;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	tags?: ITag[];
	preferredLanguage?: LanguagesEnum;
}

export interface IUserRegistrationInput {
	user: IUser;
	password?: string;
	confirmPassword?: string;
	originalUrl?: string;
	organizationId?: string;
	createdById?: string;
	isImporting?: boolean;
	sourceId?: string;
	inviteId?: string;
}

/**
 * email verfication token payload
 */
export interface IVerificationTokenPayload extends IUserEmailInput {
	id: string;
}

export interface IUserInviteCodeConfirmationInput extends IUserEmailInput, IUserCodeInput {}

export interface IUserEmailInput {
	email: string;
}

export interface IUserPasswordInput {
	password: string;
}

export interface IUserTokenInput {
	token: string;
}

export interface IUserCodeInput {
	code: number;
}

export interface IUserLoginInput extends IUserEmailInput, IUserPasswordInput {}

export interface IAuthResponse {
	user: IUser;
	token: string;
	refresh_token?: string;
}
export interface IUserCreateInput {
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: IRole;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	tags?: ITag[];
	preferredLanguage?: LanguagesEnum;
	preferredComponentLayout?: ComponentLayoutStyleEnum;
}

export interface IUserUpdateInput extends IUserCreateInput {
	id?: string;
}

export enum LanguagesEnum {
	ENGLISH = 'en',
	BULGARIAN = 'bg',
	HEBREW = 'he',
	RUSSIAN = 'ru'
}

export enum ComponentLayoutStyleEnum {
	CARDS_GRID = 'CARDS_GRID',
	TABLE = 'TABLE'
}

export enum ProviderEnum {
	GOOGLE = 'google',
	FACEBOOK = 'facebook'
}

export interface IUserViewModel extends IBasePerTenantEntityModel {
	fullName: string;
	email: string;
	bonus?: number;
	endWork?: any;
	id: string;
	roleName?: string;
	role?: string;
	tags?: ITag[];
	userOrganizationId?: string;
}
