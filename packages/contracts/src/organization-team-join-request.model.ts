import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";
import { IRelationalOrganizationTeam } from "./organization-team.model";
import { IRelationalUser, IUserEmailInput } from "./user.model";

export interface IOrganizationTeamJoinRequest extends IBasePerTenantAndOrganizationEntityModel, IUserEmailInput, IRelationalUser, IRelationalOrganizationTeam {
    fullName: string;
    linkAddress: string;
    position: string;
    status: OrganizationTeamJoinRequestStatusEnum;
    code: number;
    token: string;
    expireAt: Date;
    isExpired: boolean;
}

export enum OrganizationTeamJoinRequestStatusEnum {
    REQUESTED = "REQUESTED",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED"
}
