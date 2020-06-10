import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidatePersonalQualities extends IBaseEntityModel {
	name: string;
}

export interface ICandidatePersonalQualitiesFindInput extends IBaseEntityModel {
	name?: string;
}

export interface ICandidatePersonalQualitiesCreateInput {
	name: string;
}
