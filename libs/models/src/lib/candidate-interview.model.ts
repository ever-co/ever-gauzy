import { Employee } from './employee.model';
import {
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateCriterion
} from '@gauzy/models';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateInterview extends IBaseEntityModel {
	title: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime: Date;
	endTime: Date;
	note?: string;
	feedbacks?: ICandidateFeedback[];
	employees?: Employee[];
	criterions?: ICandidateCriterion;
}

export interface ICandidateInterviewFindInput extends IBaseEntityModel {
	title?: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime?: Date;
	endTime?: Date;
	note?: string;
	feedbacks?: ICandidateFeedback[];
	criterions?: ICandidateCriterion;
}

export interface ICandidateInterviewCreateInput {
	title: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	note?: string;
	startTime: Date;
	endTime: Date;
	feedbacks?: ICandidateFeedback[];
	criterions?: ICandidateCriterion;
}
