import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { Tag } from '..';

export interface Proposal extends IBaseEntityModel {
	employeeId?: string;
	organizationId?: string;
	employee?: Employee;
	organization?: Organization;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	tags?: Tag[];
}

export interface ProposalCreateInput {
	employeeId?: string;
	organizationId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	tags?: Tag[];
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
	status?: string;
	tags?: Tag[];
}

export enum ProposalStatusEnum {
	SENT = 'SENT',
	ACCEPTED = 'ACCEPTED'
}
