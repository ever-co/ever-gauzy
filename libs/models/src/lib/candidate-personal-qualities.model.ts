import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidatePersonalQualities
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidatePersonalQualitiesFindInput {
	name?: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidatePersonalQualitiesCreateInput {
	name: string;
	interviewId?: string;
	rating?: number;
}
