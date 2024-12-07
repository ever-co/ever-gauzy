import { IRelationalCandidateInterviewer } from './candidate-interviewers.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidateCriterionsRating } from './candidate-criterions-rating.model';
import { CandidateStatusEnum, IRelationalCandidate } from './candidate.model';
import { IRelationalCandidateInterview } from './candidate-interview.model';

export interface ICandidateFeedback extends
	IBasePerTenantAndOrganizationEntityModel,
	IRelationalCandidate,
	IRelationalCandidateInterview,
	IRelationalCandidateInterviewer
{
	description: string;
	rating: number;
	status?: CandidateStatusEnum;
	criterionsRating?: ICandidateCriterionsRating[];
	interviewTitle?: string;
}

export interface ICandidateFeedbackFindInput extends
	IBasePerTenantAndOrganizationEntityModel,
	IRelationalCandidate,
	IRelationalCandidateInterview,
	IRelationalCandidateInterviewer
{
	description?: string;
	rating?: number;
	status?: CandidateStatusEnum;
	criterionsRating?: ICandidateCriterionsRating[];
}

export interface ICandidateFeedbackCreateInput extends
	IBasePerTenantAndOrganizationEntityModel,
	IRelationalCandidate,
	IRelationalCandidateInterview,
	IRelationalCandidateInterviewer
{
	description: string;
	rating: number;
	status?: CandidateStatusEnum;
	criterionsRating?: ICandidateCriterionsRating[];
}
