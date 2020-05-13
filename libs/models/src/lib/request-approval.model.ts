import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RequestApprovalEmployee } from './request-approval-employee.model';

export interface RequestApproval extends IBaseEntityModel {
	requestApprovalEmployees?: RequestApprovalEmployee[];
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
