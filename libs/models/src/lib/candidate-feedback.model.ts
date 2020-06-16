import { ICandidateInterviewers } from './candidate-interviewers.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { ICandidateTechnologies, ICandidatePersonalQualities } from '..';

export interface ICandidateFeedback extends IBaseEntityModel {
	description: string;
	candidateId?: string;
	rating: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	interviewTitle?: string;
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}

export interface ICandidateFeedbackFindInput extends IBaseEntityModel {
	description?: string;
	candidateId?: string;
	rating?: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}

export interface ICandidateFeedbackCreateInput {
	description: string;
	candidateId?: string;
	rating: number;
	interviewId?: string;
	status?: string;
	interviewer?: ICandidateInterviewers;
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}
