import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Proposal extends IBaseEntityModel {
	employeeId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
}

export interface ProposalCreateInput {
	employeeId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
}

export interface ProposalFindInput extends IBaseEntityModel {
	employeeId?: string;
	jobPostUrl?: string;
	valueDate?: Date;
	jobPostContent?: string;
	proposalContent?: string;
}
