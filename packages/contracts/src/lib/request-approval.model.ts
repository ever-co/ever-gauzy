import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { CurrencyCode, DecimalString } from './money.model';
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
	/** The value being committed, as an exact decimal, so a threshold policy can be applied to it. */
	amount?: DecimalString;
	/** The ISO currency `amount` is stated in. */
	currency?: CurrencyCode;
	/** Free text kept beside the request, for the approver's list. */
	note?: string;
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
	/** The document the request is about. Polymorphic together with `requestType`. */
	requestId?: ID;
	/** What kind of document `requestId` names. */
	requestType?: ApprovalPolicyTypesStringEnum;
}

export interface IRequestApprovalFindInput extends IBasePerTenantAndOrganizationEntityModel {}
