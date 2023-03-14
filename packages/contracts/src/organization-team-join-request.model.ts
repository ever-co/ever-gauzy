import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IRelationalUser, IUserEmailInput } from './user.model';

export interface IOrganizationTeamJoinRequest
	extends IBasePerTenantAndOrganizationEntityModel,
	IRelationalUser,
	IOrganizationTeamJoinRequestCreateInput {
	code: number;
	token: string;
	expiredAt: Date;
	isExpired: boolean;
}

export interface IOrganizationTeamJoinRequestCreateInput extends IUserEmailInput, IRelationalOrganizationTeam {
	fullName: string;
	linkAddress: string;
	position: string;
	status: OrganizationTeamJoinRequestStatusEnum;
}

export interface IOrganizationTeamJoinRequestUpdateInput extends IOrganizationTeamJoinRequestCreateInput {
	id?: IOrganizationTeamJoinRequest['id'];
	// status: OrganizationTeamJoinRequestStatusEnum
}

export interface IOrganizationTeamJoinRequestFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
	Pick<IOrganizationTeamJoinRequest, 'organizationTeamId'> { }

export enum OrganizationTeamJoinRequestStatusEnum {
	REQUESTED = 'REQUESTED',
	ACCEPTED = 'ACCEPTED',
	REJECTED = 'REJECTED'
}
