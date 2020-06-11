import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateTechnologies extends IBaseEntityModel {
	name: string;
	interviewId?: string;
}

export interface ICandidateTechnologiesFindInput extends IBaseEntityModel {
	name?: string;
	interviewId?: string;
}

export interface ICandidateTechnologiesCreateInput {
	name: string;
	interviewId?: string;
}
