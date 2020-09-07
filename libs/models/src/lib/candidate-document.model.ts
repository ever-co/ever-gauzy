import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface ICandidateDocument extends IBaseEntityModel {
	name: string;
	candidateId?: string;
	documentUrl: string;
  organization?: Organization;
  tenant?: ITenant;
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
