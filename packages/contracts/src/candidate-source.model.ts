import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSource
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
}
export interface ICandidateSourceFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	candidateId?: string;
}

export interface ICandidateSourceCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId: string;
}
