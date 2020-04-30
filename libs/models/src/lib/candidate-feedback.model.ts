import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateFeedback extends IBaseEntityModel {
	description: string;
	candidateId?: string;
	rating: number;
}

export interface ICandidateFeedbackFindInput extends IBaseEntityModel {
	description?: string;
	candidateId?: string;
	rating?: number;
}

export interface ICandidateFeedbackCreateInput {
	description: string;
	candidateId?: string;
	rating: number;
}
