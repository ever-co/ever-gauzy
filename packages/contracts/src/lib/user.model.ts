// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { IRole } from './role.model';
import { IBasePerTenantEntityModel, IBaseRelationsEntityModel, ID } from './base-entity.model';
import { ITag } from './tag.model';
import { IEmployee } from './employee.model';
import { IPayment } from './payment.model';
import { IUserOrganization } from './user-organization.model';
import { IInvite } from './invite.model';
import { ICandidate } from './candidate.model';
import { IRelationalImageAsset } from './image-asset.model';
import { IOrganization, TimeFormatEnum } from './organization.model';
import { ISocialAccount } from './social-account.model';
import { IOrganizationTeam } from './organization-team.model';

// Define the UserStats type
export interface UserStats {
	count: number; // Total number of users
	lastMonthActiveUsers: number; // Number of users who were active in the last 30 days
}

// Interface for options to be passed to the findMeUser method.
export interface IFindMeUser extends IBaseRelationsEntityModel {
	readonly includeEmployee?: boolean;
	readonly includeOrganization?: boolean;
}

/**
 * Utility type to exclude `createdByUser` and `createdByUserId` fields.
 */
export type ExcludeUserCreatorFields<T, K extends keyof T = never> = Omit<T, 'createdByUser' | 'createdByUserId' | K>;

/**
 * Interface representing an entity with a creator association.
 */
export interface IHasUserCreator {
	createdByUser?: IUser;
	createdByUserId?: ID;
}

export interface IRelationalUser {
	user?: IUser; // User who performed the action (if applicable).
	userId?: ID; // The ID of the user who performed the action (if applicable).
}

export interface IUser extends IBasePerTenantEntityModel, IRelationalImageAsset {
	thirdPartyId?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	phoneNumber?: string;
	username?: string;
	timeZone?: string;
	timeFormat?: TimeFormatEnum;
	role?: IRole;
	roleId?: IRole['id'];
	hash?: string;
	imageUrl?: string;
	employee?: IEmployee;
	employeeId?: IEmployee['id'];
	candidate?: ICandidate;
	candidateId?: ICandidate['id'];
	defaultTeam?: IOrganizationTeam;
	defaultTeamId?: ID;
	lastTeam?: IOrganizationTeam;
	lastTeamId?: ID;
	defaultOrganization?: IOrganization;
	defaultOrganizationId?: ID;
	lastOrganization?: IOrganization;
	lastOrganizationId?: ID;
	tags?: ITag[];
	preferredLanguage?: string;
	payments?: IPayment[];
	preferredComponentLayout?: ComponentLayoutStyleEnum;
	fullName?: string;
	organizations?: IUserOrganization[];
	isImporting?: boolean;
	sourceId?: string;
	code?: string;
	codeExpireAt?: Date;
	emailVerifiedAt?: Date;
	lastLoginAt?: Date;
	isEmailVerified?: boolean;
	emailToken?: string;
	invites?: IInvite[];
	socialAccounts?: ISocialAccount[];
}

export interface IUserFindInput extends IBasePerTenantEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	phoneNumber?: string;
	username?: string;
	role?: IRole;
	roleId?: string;
	imageUrl?: string;
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
	featureAsEmployee?: boolean;
}

/**
 * email verification token payload
 */
export interface IVerificationTokenPayload extends IUserEmailInput {
	id: string;
}

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
	code: string;
}

export interface IUserLoginInput extends IUserEmailInput, IUserPasswordInput {}

export interface IDefaultTeam {
	defaultTeamId?: ID;
}

export interface IDefaultUserOrganization {
	defaultOrganizationId?: ID;
}

export interface ILastTeam {
	lastTeamId?: ID;
}

export interface ILastOrganization {
	lastOrganizationId?: ID;
}

export interface ILastLoginAtInput {
	lastLoginAt?: Date;
}

export interface IWorkspaceResponse extends IUserTokenInput {
	user: IUser;
}

export interface IUserSigninWorkspaceResponse {
	workspaces: IWorkspaceResponse[];
	confirmed_email: string;
	show_popup: boolean;
	total_workspaces: number;
	defaultTeamId?: ID;
	defaultOrganizationId?: ID;
	lastTeamId?: ID;
	lastOrganizationId?: ID;
}

export interface IAuthResponse {
	user: IUser;
	token: string;
	refresh_token?: string;
}
export interface IUserCreateInput extends IRelationalImageAsset {
	firstName?: string;
	lastName?: string;
	email?: string;
	phoneNumber?: string;
	username?: string;
	role?: IRole;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	tags?: ITag[];
	preferredLanguage?: LanguagesEnum;
	preferredComponentLayout?: ComponentLayoutStyleEnum;
	timeZone?: string;
	timeFormat?: TimeFormatEnum;
	defaultTeam?: IOrganizationTeam;
	defaultTeamId?: ID;
	lastTeam?: IOrganizationTeam;
	lastTeamId?: ID;
	defaultOrganization?: IOrganization;
	defaultOrganizationId?: ID;
	lasOrganization?: IOrganization;
	lastOrganizationId?: ID;
}

export interface IUserUpdateInput extends IUserCreateInput {
	id?: string;
}

export enum LanguagesEnum {
	ENGLISH = 'en',
	BULGARIAN = 'bg',
	HEBREW = 'he',
	RUSSIAN = 'ru',
	FRENCH = 'fr',
	SPANISH = 'es',
	CHINESE = 'zh',
	GERMAN = 'de',
	PORTUGUESE = 'pt',
	ITALIAN = 'it',
	DUTCH = 'nl',
	POLISH = 'pl',
	ARABIC = 'ar'
}

export enum ComponentLayoutStyleEnum {
	CARDS_GRID = 'CARDS_GRID',
	TABLE = 'TABLE'
}

export enum ProviderEnum {
	GITHUB = 'github',
	GOOGLE = 'google',
	FACEBOOK = 'facebook',
	TWITTER = 'twitter'
}

export interface IUserViewModel extends IBasePerTenantEntityModel {
	fullName: string;
	email: string;
	employeeId?: ID;
	bonus?: number;
	endWork?: any;
	id: string;
	roleName?: string;
	role?: string;
	tags?: ITag[];
	userOrganizationId?: string;
}
