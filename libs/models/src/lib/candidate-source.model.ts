import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSource
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
}
export interface ICandidateSourceFindInput {
	name?: string;
	candidateId?: string;
}

export interface ICandidateSourceCreateInput {
	name: string;
	candidateId: string;
}
