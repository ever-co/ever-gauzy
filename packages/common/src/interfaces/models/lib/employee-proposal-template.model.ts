import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface IEmployeeProposalTemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	employee?: IEmployee;
	name?: string;
	content?: string;
	isDefault?: boolean;
}
