import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateDocument
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
	documentUrl: string;
}

export interface ICandidateDocumentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	candidateId?: string;
	documentUrl?: string;
}

export interface ICandidateDocumentCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
	documentUrl: string;
}
