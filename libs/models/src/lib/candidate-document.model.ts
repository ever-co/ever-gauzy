import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateDocument extends IBaseEntityModel {
	name: string;
	candidateId?: string;
	documentUrl: string;
}

export interface ICandidateDocumentFindInput extends IBaseEntityModel {
	name?: string;
	candidateId?: string;
	documentUrl?: string;
}

export interface ICandidateDocumentCreateInput {
	name: string;
	candidateId?: string;
	documentUrl: string;
}
