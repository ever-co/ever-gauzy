import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';

export interface Proposal extends IBaseEntityModel {
	employeeId?: string;
	organizationId?: string;
	employee?: Employee;
	organization?: Organization;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: boolean;
}

export interface ProposalCreateInput {
	employeeId?: string;
	organizationId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
}

export interface ProposalFindInput extends IBaseEntityModel {
	employeeId?: string;
	organizationId?: string;
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: boolean;
}
