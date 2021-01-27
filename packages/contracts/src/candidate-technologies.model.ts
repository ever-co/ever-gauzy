import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateTechnologies
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidateTechnologiesFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidateTechnologiesCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}
