import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RequestApproval, Employee } from '..';

export interface RequestApprovalEmployee extends IBaseEntityModel {
	requestApprovalId: string;
	employeeId: string;
	status: number;
	requestApproval: RequestApproval;
	employee: Employee;
}
