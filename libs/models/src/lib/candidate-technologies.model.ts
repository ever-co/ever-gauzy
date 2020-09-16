import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateTechnologies
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidateTechnologiesFindInput {
	name?: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidateTechnologiesCreateInput {
	name: string;
	interviewId?: string;
	rating?: number;
}
