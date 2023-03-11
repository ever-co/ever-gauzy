import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IRelationalUser, IUserCodeInput, IUserEmailInput, IUserTokenInput } from './user.model';

export interface IOrganizationTeamJoinRequest
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalUser,
		IOrganizationTeamJoinRequestCreateInput,
		IUserCodeInput,
		IUserTokenInput {
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
	// status: OrganizationTeamJoinRequestStatusEnum;
}

export interface IOrganizationTeamJoinRequestFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<IOrganizationTeamJoinRequest, 'organizationTeamId'> {}

export enum OrganizationTeamJoinRequestStatusEnum {
	REQUESTED = 'REQUESTED',
	ACCEPTED = 'ACCEPTED',
	REJECTED = 'REJECTED'
}
