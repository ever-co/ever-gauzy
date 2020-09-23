import { ICandidateInterviewers } from './candidate-interviewers.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidateCriterionsRating } from './candidate-criterions-rating.model';

export interface ICandidateFeedback
	extends IBasePerTenantAndOrganizationEntityModel {
	description: string;
	candidateId?: string;
	rating: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	interviewTitle?: string;
	criterionsRating?: ICandidateCriterionsRating[];
}

export interface ICandidateFeedbackFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	description?: string;
	candidateId?: string;
	rating?: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	criterionsRating?: ICandidateCriterionsRating[];
}

export interface ICandidateFeedbackCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	description: string;
	candidateId?: string;
	rating: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	criterionsRating?: ICandidateCriterionsRating[];
}
