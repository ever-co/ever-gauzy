import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidateTechnologies } from './candidate-technologies.model';
import { ICandidatePersonalQualities } from './candidate-personal-qualities.model';
import { ICandidateFeedback } from './candidate-feedback.model';

export interface ICandidateCriterionsRatingBase 
	extends IBasePerTenantAndOrganizationEntityModel {
	technologyId?: string;
	technology?: ICandidateTechnologies;
	personalQualityId?: string;
	personalQuality?: ICandidatePersonalQualities;
	feedbackId?: string;
	feedback?: ICandidateFeedback;
}

export interface ICandidateCriterionsRating
	extends ICandidateCriterionsRatingBase {
	rating: number;
}

export interface ICandidateCriterionsRatingFindInput
	extends ICandidateCriterionsRatingBase {
	rating?: number;
}

export interface ICandidateCriterionsRatingCreateInput
	extends ICandidateCriterionsRatingBase {
	rating: number;
}
