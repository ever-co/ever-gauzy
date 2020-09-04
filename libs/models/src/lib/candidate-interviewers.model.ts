import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface ICandidateInterviewers extends IBaseEntityModel {
	interviewId: string;
	employeeId: string;
	employeeImageUrl?: string;
	employeeName?: string;
  organization?: Organization;
  tenant: ITenant;
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
