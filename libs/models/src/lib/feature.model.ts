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

export interface IFeatureOrganizationUpdateInput
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

export enum IFeatureToggleTypeEnum {
	RELEASE = 'release',
	KILL_SWITCH = 'kill-switch',
	EXPERIMENT = 'experiment',
	OPERATIONAL = 'operational',
	PERMISSION = 'permission'
}

export interface IFeatureToggleVariant {
	name?: string;
	weight?: number;
	weightType?: string;
	payload?: IFeatureTogglePayload;
	overrides?: IFeatureToggleOverride[];
}

export interface IFeatureToggleOverride {
	contextName?: string;
	values?: string[];
}

export interface IFeatureTogglePayload {
	type?: string;
	value?: string;
}

export interface IFeatureToggle {
	name: string;
	description?: string;
	type: IFeatureToggleTypeEnum;
	project?: string;
	enabled: boolean;
	stale?: boolean;
	strategies?: any;
	variants?: IFeatureToggleVariant[];
	createdAt?: string;
	lastSeenAt?: string | null;
}
