import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateCriterionsRating
	extends IBasePerTenantAndOrganizationEntityModel {
	rating: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
}

export interface ICandidateCriterionsRatingFindInput {
	rating?: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
}

export interface ICandidateCriterionsRatingCreateInput {
	rating: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
}
