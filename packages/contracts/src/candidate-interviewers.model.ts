import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateInterviewers
	extends IBasePerTenantAndOrganizationEntityModel {
	interviewId: string;
	employeeId: string;
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
