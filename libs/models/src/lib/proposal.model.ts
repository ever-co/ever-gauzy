import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';
import { ITag } from './tag-entity.model';

export interface IProposal extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	employee?: IEmployee;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	tags?: ITag[];
}

export interface IProposalCreateInput {
	employeeId?: string;
	organizationId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	tags?: ITag[];
}

export interface IProposalFindInput {
	employeeId?: string;
	organizationId?: string;
	employee?: IEmployeeFindInput;
	organization?: IOrganizationFindInput;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	tags?: ITag[];
}

export enum ProposalStatusEnum {
	SENT = 'SENT',
	ACCEPTED = 'ACCEPTED'
}
