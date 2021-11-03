import { IOrganizationContact } from './organization-contact.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { ITag } from './tag-entity.model';

export interface IProposal extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	employee: IEmployee;
	jobPostUrl: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
	tags?: ITag[];
	organizationContact?: IOrganizationContact;
	organizationContactId?: string;
}

export interface IProposalCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
	tags?: ITag[];
	organizationContactId?: string;
}

export interface IProposalFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
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
export interface IProposalViewModel
	extends IBasePerTenantAndOrganizationEntityModel {
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
	organizationContact?: IOrganizationContact;
}
