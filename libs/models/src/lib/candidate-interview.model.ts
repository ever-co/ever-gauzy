import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateInterview extends IBaseEntityModel {
	title: string;
	candidateId?: string;
	interviewers: string[];
	location?: string;
	startTime: Date;
	endTime: Date;
	note?: string;
}

export interface ICandidateInterviewFindInput extends IBaseEntityModel {
	title?: string;
	candidateId?: string;
	interviewers?: string[];
	location?: string;
	startTime?: Date;
	endTime?: Date;
	note?: string;
}

export interface ICandidateInterviewCreateInput {
	title: string;
	candidateId?: string;
	interviewers: string[];
	location?: string;
	note?: string;
	startTime: Date;
	endTime: Date;
}
