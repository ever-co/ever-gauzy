import { IRole } from './role.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import {
	IUser,
	IUserCodeInput,
	IUserEmailInput,
	IUserRegistrationInput,
	IUserTokenInput,
	LanguagesEnum
} from './user.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganization } from './organization.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationDepartment } from './organization-department.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';

export interface IInvite extends IBasePerTenantAndOrganizationEntityModel, IUserEmailInput, IUserTokenInput, Partial<IUserCodeInput> {
	status: InviteStatusEnum;
	expireDate: Date;
	actionDate?: Date;
	role?: IRole;
	roleId: IRole['id'];
	invitedBy?: IUser;
	invitedById: IUser['id'];
	projects?: IOrganizationProject[];
	teams?: IOrganizationTeam[];
	organizationContacts?: IOrganizationContact[];
	departments?: IOrganizationDepartment[];
	user?: IUser;
	userId?: IUser['id'];
	fullName?: string;
	isExpired?: boolean;
}

export interface IInviteAcceptInput extends IUserRegistrationInput, IUserEmailInput, IUserTokenInput, IUserCodeInput {
	inviteId?: string;
	originalUrl?: string;
}

export interface IInviteResendInput extends IBasePerTenantAndOrganizationEntityModel {
	inviteId: IInvite['id'];
	inviteType: InvitationTypeEnum;
	[x: string]: any;
}

export interface ICreateEmailInvitesInput extends IBasePerTenantAndOrganizationEntityModel {
	emailIds: string[];
	projectIds?: string[];
	organizationContactIds?: string[];
	departmentIds?: string[];
	teamIds?: string[];
	roleId: string;
	inviteType: InvitationTypeEnum;
	startedWorkOn: Date;
	appliedDate?: Date;
	invitationExpirationPeriod?: number | string;
	fullName?: string;
	[x: string]: any;
}

export interface ICreateOrganizationContactInviteInput extends IBasePerTenantAndOrganizationEntityModel {
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

export interface IInviteFindInput extends IBasePerTenantAndOrganizationEntityModel {
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
	ACCEPTED = 'ACCEPTED',
	EXPIRED = 'EXPIRED',
	REJECTED = 'REJECTED'
}

export enum InviteActionEnum {
	ACCEPTED = 'ACCEPTED',
	REJECTED = 'REJECTED'
}

export enum InvitationTypeEnum {
	USER = 'USER',
	EMPLOYEE = 'EMPLOYEE',
	CANDIDATE = 'CANDIDATE',
	TEAM = 'TEAM'
}

export enum InvitationExpirationEnum {
	DAY = 1,
	WEEK = 7,
	TWO_WEEK = 14,
	MONTH = 30,
	NEVER = 'Never'
}

export interface IInviteViewModel extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	expireDate: string;
	createdDate: string;
	imageUrl: string;
	fullName: string;
	roleName?: string;
	status: string;
	projectNames: string[];
	clientNames: string[];
	departmentNames: string[];
	id: string;
	token: string;
}

export interface IInviteUserModel extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	role: string;
	registerUrl: string;
	languageCode: LanguagesEnum;
	invitedBy: IUser;
	originUrl?: string;
}
export interface IInviteEmployeeModel extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	registerUrl: string;
	languageCode: LanguagesEnum;
	invitedBy: IUser;
	projects?: IOrganizationProject[];
	organizationContacts?: IOrganizationContact[];
	departments?: IOrganizationDepartment[];
	originUrl?: string;
}

export interface IInviteTeamMemberModel extends IBasePerTenantAndOrganizationEntityModel, IUserEmailInput {
	languageCode: LanguagesEnum;
	invitedBy: IUser;
	teams: string;
	inviteCode: string;
	[x: string]: any;
}

export interface IJoinEmployeeModel extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	employee: IEmployee;
	organization: IOrganization;
	languageCode: LanguagesEnum;
}
