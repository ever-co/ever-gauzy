import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidateCriterionsRating } from './candidate-criterions-rating.model';
import { ICandidateInterview } from './candidate-interview.model';

export interface ICandidateTechnologies
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	interview?: ICandidateInterview;
	rating?: number;
	criterionsRatings?: ICandidateCriterionsRating[]
}

export interface ICandidateTechnologiesFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	interviewId?: string;
	interview?: ICandidateInterview;
	rating?: number;
}

export interface ICandidateTechnologiesCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	interview?: ICandidateInterview;
	rating?: number;
}
