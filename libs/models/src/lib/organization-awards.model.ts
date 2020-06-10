import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface OrganizationAwards extends IBaseEntityModel {
	name: string;
	organizationId: string;
	year: string;
}

export interface OrganizationAwardsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	year?: string;
}

export interface OrganizationAwardsCreateInput {
	name: string;
	organizationId: string;
	year: string;
}
