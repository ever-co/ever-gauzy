import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateCriterionsRating
	extends IBasePerTenantAndOrganizationEntityModel {
	rating: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
}

export interface ICandidateCriterionsRatingFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	rating?: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
}

export interface ICandidateCriterionsRatingCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	rating: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
}
