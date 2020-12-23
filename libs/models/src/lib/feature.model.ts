import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
export interface IFeature extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	description: string;
	featureOrganizations?: IFeatureOrganization[];
	image: string;
	readonly imageUrl?: string;
	link: string;
	name: string;
	status: string;
	icon: string;
	isEnabled?: boolean;
	isPaid?: boolean;
	readonly parentId?: string;
	parent?: IFeature;
	children?: IFeature[];
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

export interface IFeatureOrganizationCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	featureId: string;
	isEnabled: boolean;
}

export interface IFeatureOrganizationFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	featureId?: string;
}

export enum FeatureStatusEnum {
	INFO = 'info',
	PRIMARY = 'primary',
	SUCCESS = 'success',
	WARNING = 'warning'
}
