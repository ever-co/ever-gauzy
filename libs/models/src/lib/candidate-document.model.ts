import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateDocument
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
	documentUrl: string;
}

export interface ICandidateDocumentFindInput {
	name?: string;
	candidateId?: string;
	documentUrl?: string;
}

export interface ICandidateDocumentCreateInput {
	name: string;
	candidateId?: string;
	documentUrl: string;
}
