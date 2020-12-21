import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
export interface IFeature extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	description?: string;
	featureOrganizations?: IFeatureOrganization[];
	image?: string;
	imageUrl?: string;
	link: string;
	name: string;
	status?: string;
	icon?: string;
	isEnabled?: boolean;
}
export interface IFeatureCreateInput extends IFeature {
	isEnabled: boolean;
}

export interface IFeatureOrganization
	extends IBasePerTenantAndOrganizationEntityModel {
	feature: IFeature;
	featureId?: string;
	isEnabled: boolean;
}

export enum FeatureStatusEnum {
	INFO = 'info',
	PRIMARY = 'primary',
	SUCCESS = 'success',
	WARNING = 'warning'
}
