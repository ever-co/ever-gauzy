import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface ICandidateSource extends IBaseEntityModel {
	name: string;
	candidateId?: string;
}
export interface ICandidateSourceFindInput extends IBaseEntityModel {
	name?: string;
	candidateId?: string;
}
