import { IOrganizationContactEntityMutationInput, IRelationalOrganizationContact } from './organization-contact.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee, IEmployeeEntityMutationInput, IEmployeeEntityInput } from './employee.model';
import { ITaggable } from './tag.model';

/**
 * Proposal Status Enum
 */
export enum ProposalStatusEnum {
	SENT = 'SENT',
	ACCEPTED = 'ACCEPTED'
}

// Base interface for common proposal fields
export interface IProposalBase extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	jobPostUrl: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
	status?: ProposalStatusEnum;
}

export interface IProposal extends IProposalBase, IEmployeeEntityInput, IRelationalOrganizationContact {
	author?: IEmployee;
}

/**
 * Proposal Base Create Input
 */
export interface IProposalBaseCreateInput extends IEmployeeEntityMutationInput, Partial<IProposalBase> {}

/**
 * Proposal Create Input
 */
export interface IProposalCreateInput extends IProposalBaseCreateInput, IOrganizationContactEntityMutationInput {}

/**
 * Proposal Find Input
 */
export interface IProposalFindInput
	extends Omit<IProposalBase, 'jobPostLink' | 'jobPostContent' | 'proposalContent' | 'jobPostUrl'> {}

/**
 * Proposal View Model
 */
export interface IProposalViewModel extends IRelationalOrganizationContact, Partial<IProposalBase> {
	valueDate: Date;
	id: string;
	employeeId?: string;
	employee?: IEmployee;
	jobPostLink?: string;
	author?: IEmployee;
}
