import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IOrganizationVendor extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface IOrganizationVendorFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationVendorCreateInput {
	name: string;
	organizationId: string;
}

export enum OrganizationVendorEnum {
	UPWORK = 'Upwork',
	MICROSOFT = 'Microsoft',
	BENEFIT_SYSTEMS = 'Benefit Systems',
	UDEMY = 'Udemy',
	GOOGLE = 'Google',
	CO_SHARE = 'CoShare'
}
