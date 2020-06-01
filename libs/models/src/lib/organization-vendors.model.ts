import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from '..';

export interface IOrganizationVendor extends IBaseEntityModel {
	name: string;
	organizationId: string;
	tags?: Tag[];
}

export interface IOrganizationVendorFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	tags?: Tag[];
}

export interface IOrganizationVendorCreateInput {
	name: string;
	organizationId: string;
	tags?: Tag[];
}

export enum OrganizationVendorEnum {
	UPWORK = 'Upwork',
	MICROSOFT = 'Microsoft',
	BENEFIT_SYSTEMS = 'Benefit Systems',
	UDEMY = 'Udemy',
	GOOGLE = 'Google',
	CO_SHARE = 'CoShare'
}
