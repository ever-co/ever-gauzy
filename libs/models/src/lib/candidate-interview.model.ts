import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { ICandidateInterviewers } from '..';

export interface ICandidateInterview extends IBaseEntityModel {
	title: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime: Date;
	endTime: Date;
	note?: string;
}

export interface ICandidateInterviewFindInput extends IBaseEntityModel {
	title?: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime?: Date;
	endTime?: Date;
	note?: string;
}

export interface ICandidateInterviewCreateInput {
	title: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	note?: string;
	startTime: Date;
	endTime: Date;
}
