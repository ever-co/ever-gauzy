import { ICandidateInterview } from './candidate-interview.model';
import { IEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IRelationalCandidateInterviewer {
	readonly interviewer?: ICandidateInterviewers;
	readonly interviewerId?: ICandidateInterviewers['id'];
}

export interface ICandidateInterviewers
	extends IBasePerTenantAndOrganizationEntityModel {
	interviewId: string;
	interview: ICandidateInterview;
	employeeId: string;
	employee: IEmployee;
	employeeImageUrl?: string;
	employeeName?: string;
}

export interface ICandidateInterviewersFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	interviewId?: string;
	employeeId?: string;
}

export interface ICandidateInterviewersCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	interviewId: string;
	employeeId?: string;
	employeeIds?: string[];
}

export interface ICandidateInterviewersDeleteInput {
	interviewId?: string;
	employeeId?: string;
}
