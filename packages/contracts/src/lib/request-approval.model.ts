import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IRequestApprovalEmployee } from './request-approval-employee.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';
import { IRequestApprovalTeam } from './request-approval-team.model';
import { ApprovalPolicyTypesStringEnum, IApprovalPolicy } from './approval-policy.model';
import { ITaggable } from './tag.model';

export enum RequestApprovalStatusTypesEnum {
	REQUESTED = 1,
	APPROVED = 2,
	REFUSED = 3
}

export const RequestApprovalStatus = {
	REQUESTED: 1,
	APPROVED: 2,
	REFUSED: 3
};

export interface IBaseRequestApprovalProperties extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	min_count: number;
	approvalPolicyId?: ID;
	approvalPolicy?: IApprovalPolicy;
}

interface IRequestApprovalAssociations extends ITaggable {
	employeeApprovals?: IRequestApprovalEmployee[];
	teamApprovals?: IRequestApprovalTeam[];
	employees?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface IRequestApproval extends IBaseRequestApprovalProperties, IRequestApprovalAssociations {
	status: number;
	requestId: ID;
	requestType: ApprovalPolicyTypesStringEnum;
}

export interface IRequestApprovalCreateInput extends IBaseRequestApprovalProperties, IRequestApprovalAssociations {
	status?: number;
}

export interface IRequestApprovalFindInput extends IBasePerTenantAndOrganizationEntityModel {}
