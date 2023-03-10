import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRequestApprovalEmployee } from './request-approval-employee.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';
import { IRequestApprovalTeam } from './request-approval-team.model';
import { IApprovalPolicy } from './approval-policy.model';
import { ITag } from './tag.model';

export interface IRequestApproval extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	status: number;
	createdBy: string;
	createdByName: string;
	min_count: number;
	requestId: string;
	requestType: string;
	approvalPolicy: IApprovalPolicy;
	approvalPolicyId: string;
	employeeApprovals?: IRequestApprovalEmployee[];
	teamApprovals?: IRequestApprovalTeam[];
	tags?: ITag[];
	employees?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface IRequestApprovalCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	employeeApprovals?: IRequestApprovalEmployee[];
	teamApprovals?: IRequestApprovalTeam[];
	teams?: IOrganizationTeam[];
	employees?: IEmployee[];
	name?: string;
	min_count?: number;
	status?: number;
	approvalPolicyId?: string;
	tags?: ITag[];
}

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

export interface IRequestApprovalFindInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface IApprovalsData {
	icon: string;
	title: string;
}
