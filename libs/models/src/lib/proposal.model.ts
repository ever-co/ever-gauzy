import { Employee, EmployeeFindInput } from './employee.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Proposal extends IBaseEntityModel {
	employee?: Employee;
	employeeId?: string;
	jobPostUrl?: string;
	valueDate: Date;
	jobPostContent?: string;
	proposalContent?: string;
}

export interface ProposalCreateInput {
	employee?: Employee;
	employeeId?: string;
	jobPostUrl?: string;
	valueDate: Date;
	jobPostContent?: string;
	proposalContent?: string;
}
