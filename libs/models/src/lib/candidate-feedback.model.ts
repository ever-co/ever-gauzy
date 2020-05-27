import { ICandidateInterviewers } from './candidate-interviewers.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateFeedback extends IBaseEntityModel {
	description: string;
	candidateId?: string;
	rating: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	interviewTitle?: string;
}

export interface ICandidateFeedbackFindInput extends IBaseEntityModel {
	description?: string;
	candidateId?: string;
	rating?: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
}

export interface ICandidateFeedbackCreateInput {
	description: string;
	candidateId?: string;
	rating: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
}
