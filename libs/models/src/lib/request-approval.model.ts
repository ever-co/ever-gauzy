import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RequestApprovalEmployee } from './request-approval-employee.model';
import { Employee } from './employee.model';
import { OrganizationTeam } from './organization-team-model';

export interface RequestApproval extends IBaseEntityModel {
	requestApprovalEmployees?: RequestApprovalEmployee[];
	employees?: Employee[];
	teams?: OrganizationTeam[];
	name?: string;
	type?: number;
	min_count?: number;
	status?: number;
	approvalPolicyId?: string;
}

export interface RequestApprovalCreateInput extends IBaseEntityModel {
	requestApprovalEmployees?: RequestApprovalEmployee[];
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
