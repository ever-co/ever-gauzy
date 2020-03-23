import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface OrganizationVendors extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface OrganizationVendorsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface OrganizationVendorsCreateInput {
	name: string;
	organizationId: string;
}

export enum OrganizationVendorsEnum {
	UPWORK = 'Upwork',
	MICROSOFT = 'Microsoft',
	BENEFIT_SYSTEMS = 'Benefit Systems',
	UDEMY = 'Udemy',
	GOOGLE = 'Google',
	CO_SHARE = 'CoShare'
}
