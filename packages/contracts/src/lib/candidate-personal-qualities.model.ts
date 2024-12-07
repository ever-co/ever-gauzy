import { ICandidateInterview } from './candidate-interview.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidatePersonalQualities
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	interview?: ICandidateInterview;
	rating?: number;
}

export interface ICandidatePersonalQualitiesFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	interviewId?: string;
	interview?: ICandidateInterview;
	rating?: number;
}

export interface ICandidatePersonalQualitiesCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	interview?: ICandidateInterview;
	rating?: number;
}
