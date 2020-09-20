import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
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

export interface IProposalCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	tags?: ITag[];
}

export interface IProposalFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	employee?: IEmployeeFindInput;
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
