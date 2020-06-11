import { ICandidatePersonalQualities } from './candidate-personal-qualities.model';
import { Employee } from './employee.model';
import {
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies
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
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
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
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
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
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}
