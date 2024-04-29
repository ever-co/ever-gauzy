import { IOrganizationContactEntityMutationInput, IRelationalOrganizationContact } from './organization-contact.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeEntityMutationInput, IEmployeeFindInput } from './employee.model';
import { ITag } from './tag.model';

export interface IProposal extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationContact {
	employeeId?: string;
	employee?: IEmployee;
	jobPostUrl: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
	tags?: ITag[];
}

export interface IProposalCreateInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityMutationInput, IOrganizationContactEntityMutationInput {
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
	tags?: ITag[];
}

export interface IProposalFindInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	employee?: IEmployeeFindInput;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
	tags?: ITag[];
}

export enum ProposalStatusEnum {
	SENT = 'SENT',
	ACCEPTED = 'ACCEPTED'
}
export interface IProposalViewModel extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationContact {
	tags?: ITag[];
	valueDate: Date;
	id: string;
	employeeId?: string;
	employee?: IEmployee;
	jobPostUrl?: string;
	jobPostLink?: string;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
	author?: string;
}
