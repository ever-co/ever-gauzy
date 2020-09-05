import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RequestApproval, Employee, Organization, ITenant } from '..';

export interface RequestApprovalEmployee extends IBaseEntityModel {
	requestApprovalId: string;
	employeeId: string;
	status: number;
	requestApproval: RequestApproval;
	employee: Employee;
  organization?: Organization;
  tenant: ITenant;
}
