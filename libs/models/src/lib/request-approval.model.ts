import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RequestApprovalEmployee } from './request-approval-employee.model';
import { Employee } from './employee.model';
import { OrganizationTeam } from './organization-team-model';
import { RequestApprovalTeam } from './request-approval-team.model';

export interface RequestApproval extends IBaseEntityModel {
	employeeApprovals?: RequestApprovalEmployee[];
	teamApprovals?: RequestApprovalTeam[];
	employees?: Employee[];
	teams?: OrganizationTeam[];
	name?: string;
	type?: number;
	min_count?: number;
	status?: number;
	approvalPolicyId?: string;
}

export interface RequestApprovalCreateInput extends IBaseEntityModel {
	employeeApprovals?: RequestApprovalEmployee[];
	teamApprovals?: RequestApprovalTeam[];
	teams?: OrganizationTeam[];
	employees?: Employee[];
	name?: string;
	type?: number;
	min_count?: number;
	status?: number;
	approvalPolicyId?: string;
}

export enum RequestApprovalStatusTypesEnum {
	REQUESTED = 1,
	APPROVED = 2,
	REFUSED = 3
}
