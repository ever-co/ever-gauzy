import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRequestApproval } from './request-approval.model';
import { IEmployee } from './employee.model';

export interface IRequestApprovalEmployee
	extends IBasePerTenantAndOrganizationEntityModel {
	requestApprovalId: string;
	employeeId: string;
	status: number;
	requestApproval: IRequestApproval;
	employee: IEmployee;
}
