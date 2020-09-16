import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IOrganizationVendor
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	phone?: string;
	website?: string;
	email?: string;
	tags?: ITag[];
}

export interface IOrganizationVendorFindInput {
	name?: string;
	phone?: string;
	website?: string;
	email?: string;
	organizationId?: string;
	tags?: ITag[];
}

export interface IOrganizationVendorCreateInput {
	name: string;
	phone?: string;
	website?: string;
	email?: string;
	organizationId: string;
	tags?: ITag[];
}

export enum OrganizationVendorEnum {
	UPWORK = 'Upwork',
	MICROSOFT = 'Microsoft',
	BENEFIT_SYSTEMS = 'Benefit Systems',
	UDEMY = 'Udemy',
	GOOGLE = 'Google',
	CO_SHARE = 'CoShare'
}
