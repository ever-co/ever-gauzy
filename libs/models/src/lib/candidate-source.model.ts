import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';
export interface ICandidateSource extends IBaseEntityModel {
	name: string;
	candidateId?: string;
  organization?: Organization;
  tenant?: ITenant;
}
export interface ICandidateSourceFindInput extends IBaseEntityModel {
	name?: string;
	candidateId?: string;
}

export interface ICandidateSourceCreateInput {
	name: string;
	candidateId: string;
}
