import { ICandidateInterviewers } from './candidate-interviewers.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidateCriterionsRating } from './candidate-criterions-rating.model';
import { ICandidate } from './candidate.model';
import { ICandidateInterview } from './candidate-interview.model';

export interface ICandidateFeedback
	extends IBasePerTenantAndOrganizationEntityModel {
	description: string;
	rating: number;
	status?: string;
	candidateId?: string;
	candidate?: ICandidate;
	interview?: ICandidateInterview;
	interviewId?: string;
	criterionsRating?: ICandidateCriterionsRating[];
	interviewer?: ICandidateInterviewers;
	interviewTitle?: string;
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
