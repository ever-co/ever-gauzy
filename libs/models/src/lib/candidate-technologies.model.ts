import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateTechnologies extends IBaseEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
	// rating?: ICandidateCriterionsRating;
}

export interface ICandidateTechnologiesFindInput extends IBaseEntityModel {
	name?: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidateTechnologiesCreateInput {
	name: string;
	interviewId?: string;
	rating?: number;
}
