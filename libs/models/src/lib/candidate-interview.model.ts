import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateInterview extends IBaseEntityModel {
	title: string;
	candidateId?: string;
	date: Date;
	interviewers: string[];
	location?: string;
	duration: string;
	timeZone: string;
	note?: string;
	// interviewersNotification: boolean;
	// candidateNotification: boolean;
}

export interface ICandidateInterviewFindInput extends IBaseEntityModel {
	title?: string;
	candidateId?: string;
	date?: Date;
	interviewers?: string[];
	location?: string;
	duration?: string;
	timeZone?: string;
	note?: string;
	// interviewersNotification?: boolean;
	// candidateNotification?: boolean;
}

export interface ICandidateInterviewCreateInput {
	title: string;
	candidateId?: string;
	date: Date;
	interviewers: string[];
	location?: string;
	duration: string;
	timeZone: string;
	note?: string;
	// interviewersNotification: boolean;
	// candidateNotification: boolean;
}
