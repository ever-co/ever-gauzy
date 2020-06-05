import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateInterviewers extends IBaseEntityModel {
	interviewId: string;
	employeeId: string;
	employeeImageUrl?: string;
	employeeName?: string;
}

export interface ICandidateInterviewersFindInput extends IBaseEntityModel {
	interviewId?: string;
	employeeId?: string;
}

export interface ICandidateInterviewersCreateInput {
	interviewId: string;
	employeeId: string;
}
export interface ICandidateInterviewersDeleteInput {
	interviewId?: string;
	employeeId?: string;
}
