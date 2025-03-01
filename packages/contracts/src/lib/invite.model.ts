import { IRelationalRole, IRole } from './role.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IRelationalUser, IUser, IUserRegistrationInput, LanguagesEnum } from './user.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganization } from './organization.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationDepartment } from './organization-department.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';

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

interface IInviteBase extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	token: string;
	code?: string;
	status: InviteStatusEnum;
	expireDate: Date;
	actionDate?: Date;
	fullName?: string;
	isExpired?: boolean;
}

interface IInviteAssociations extends IRelationalUser, IRelationalRole {
	projects?: IOrganizationProject[];
	teams?: IOrganizationTeam[];
	organizationContacts?: IOrganizationContact[];
	departments?: IOrganizationDepartment[];
}

export interface IInvite extends IInviteBase, IInviteAssociations {
	invitedByUser?: IUser;
	invitedByUserId?: ID;
}

export interface IInviteAcceptInput extends IUserRegistrationInput {
	email: string;
	token: string;
	code: string;
	inviteId?: ID;
	originalUrl?: string;
}

export interface IInviteResendInput extends IBasePerTenantAndOrganizationEntityModel {
	inviteId: ID;
	inviteType: InvitationTypeEnum;
	[x: string]: any;
}

export interface ICreateEmailInvitesInput extends IBasePerTenantAndOrganizationEntityModel {
	emailIds: ID[];
	projectIds?: ID[];
	organizationContactIds?: ID[];
	departmentIds?: ID[];
	teamIds?: ID[];
	roleId: ID;
	inviteType: InvitationTypeEnum;
	startedWorkOn: Date;
	appliedDate?: Date;
	invitationExpirationPeriod?: number | string;
	fullName?: string;
	[x: string]: any;
}

export interface ICreateOrganizationContactInviteInput extends IBasePerTenantAndOrganizationEntityModel {
	emailId: string;
	organizationContactId: ID;
	roleId: ID;
	invitedByUserId: ID;
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

export interface IPublicInviteFindInput extends Pick<IInviteBase, 'email' | 'token'> {}

export interface IInviteUpdateInput {
	status: InviteStatusEnum;
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
	token: string;
}

// Common base for invite models that share email, registerUrl, languageCode, invitedByUser, and originUrl.
export interface IBaseInviteModel extends IBasePerTenantAndOrganizationEntityModel {
	email: string;
	registerUrl?: string;
	languageCode: LanguagesEnum;
	invitedByUser: IUser;
	originUrl?: string;
}

// Invite User Model adds a role property to the base invite.
export interface IInviteUserModel extends IBaseInviteModel {
	role: string;
}

// Invite Employee Model extends the base invite and any additional associations.
export interface IInviteEmployeeModel extends IBaseInviteModel, IInviteAssociations {}

// Invite Team Member Model has a slightly different shape, so it remains separate.
// It extends from the base organization entity.
export interface IInviteTeamMemberModel extends IBasePerTenantAndOrganizationEntityModel, IBaseInviteModel {
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

/**
 * Parameters required to create an Invite.
 */
export interface ICreateInviteSeedParams extends IBasePerTenantAndOrganizationEntityModel {
	superAdmins: IUser[];
	roles: IRole[];
}
