import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface ICandidateCriterionsRating extends IBaseEntityModel {
	rating: number;
	technologyId?: string;
	personalQualityId?: string;
	feedbackId?: string;
  organization?: Organization;
  tenant: ITenant;
}

export interface ICandidateCriterionsRatingFindInput extends IBaseEntityModel {
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
