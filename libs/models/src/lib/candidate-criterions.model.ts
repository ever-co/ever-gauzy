import { ICandidateTechnologies } from './candidate-technologies.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { ICandidatePersonalQualities } from './candidate-personal-qualities.model';

export interface ICandidateCriterion extends IBaseEntityModel {
	technologies: ICandidateTechnologies[];
	personalQualities: ICandidatePersonalQualities[];
	interviewId: string;
}

export interface ICandidateCriterionFindInput extends IBaseEntityModel {
	technologies: ICandidateTechnologies[];
	personalQualities: ICandidatePersonalQualities[];
	interviewId?: string;
}

export interface ICandidateCriterionCreateInput {
	technologies: ICandidateTechnologies[];
	personalQualities: ICandidatePersonalQualities[];
	interviewId: string;
}
