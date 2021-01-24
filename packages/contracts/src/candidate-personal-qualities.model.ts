import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidatePersonalQualities
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidatePersonalQualitiesFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidatePersonalQualitiesCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}
