import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RequestApprovalEmployee } from './request-approval-employee.model';

export interface RequestApproval extends IBaseEntityModel {
	requestApprovalEmployee?: RequestApprovalEmployee[];
	name?: string;
	type?: number;
	min_count?: number;
	createdEmployeeId?: string;
	status?: number;
	approvalsPolicyId?: string;
}
