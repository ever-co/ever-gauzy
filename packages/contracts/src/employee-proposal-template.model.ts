import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeEntityMutationInput } from './employee.model';

export interface IEmployeeProposalTemplate extends IEmployeeProposalTemplateBaseInput {
	employeeId?: IEmployee['id'];
	employee?: IEmployee;
}

export interface IEmployeeProposalTemplateBaseInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	content?: string;
	isDefault?: boolean;
}

export interface IEmployeeProposalTemplateCreateInput
	extends IEmployeeEntityMutationInput,
		IEmployeeProposalTemplateBaseInput {
	name: string;
}

export interface IEmployeeProposalTemplateUpdateInput extends IEmployeeProposalTemplateBaseInput {}
