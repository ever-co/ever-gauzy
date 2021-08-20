import {
	IBaseEntityModel,
	IBasePerTenantAndOrganizationEntityModel
} from './base-entity.model';
import { IOrganizationProjectsCreateInput } from './organization-projects.model';
import { ITag } from './tag-entity.model';

export interface IIntegrationSetting
	extends IBasePerTenantAndOrganizationEntityModel {
	settingsName: string;
	settingsValue: string;
	integration?: IIntegrationTenant;
	integrationId?: string;
}

export interface IIntegrationEntitySetting
	extends IBasePerTenantAndOrganizationEntityModel {
	entity: string;
	sync: boolean;
	integration?: IIntegrationTenant;
	readonly integrationId?: string;
	tiedEntities?: IIntegrationEntitySettingTied[];
}

export interface IIntegrationEntitySettingTied
	extends IBasePerTenantAndOrganizationEntityModel {
	entity: string;
	sync: boolean;
	integrationEntitySetting?: IIntegrationEntitySetting;
	readonly integrationEntitySettingId?: string;
}

export interface IIntegrationMap
	extends IBasePerTenantAndOrganizationEntityModel {
	integration: IIntegrationTenant;
	sourceId: string;
	gauzyId: string;
}

export interface IIntegrationViewModel {
	name: string;
	imgSrc: string;
	navigation_url: string;
	isComingSoon?: boolean;
}

export interface IIntegrationTenant extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export interface IIntegration {
	name: string;
	imgSrc: string;
	isComingSoon?: boolean;
	isPaid?: boolean;
	version?: string;
	docUrl?: string;
	isFreeTrial?: boolean;
	freeTrialPeriod?: number;
	order?: number;
	integrationTypes?: IIntegrationType[];
	tags?: ITag[];
}

export interface IIntegrationType extends IBaseEntityModel {
	name: string;
	groupName: string;
	order: number;
}

export interface IIntegrationFilter {
	integrationTypeId: string;
	searchQuery: string;
	filter: string;
}

export interface IIntegrationMapSyncProject {
	organizationProjectCreateInput: IOrganizationProjectsCreateInput;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncEntityInput
	extends IBasePerTenantAndOrganizationEntityModel {
	integrationId: string;
	sourceId: string;
	gauzyId: string;
	entity: string;
}

export interface IIntegrationTenantCreateDto
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export enum IntegrationEnum {
	UPWORK = 'Upwork',
	HUBSTAFF = 'Hubstaff'
}

export enum IntegrationEntity {
	PROJECT = 'Project',
	ORGANIZATION = 'Organization',
	NOTE = 'Note',
	CLIENT = 'Client',
	TASK = 'Task',
	ACTIVITY = 'Activity',
	USER = 'User',
	EMPLOYEE = 'Employee',
	TIME_LOG = 'TimeLog',
	TIME_SLOT = 'TimeSlot',
	SCREENSHOT = 'Screenshot',
	INCOME = 'Income',
	EXPENSE = 'Expense',
	PROPOSAL = 'Proposal'
}

export enum IntegrationTypeGroupEnum {
	FEATURED = 'Featured',
	CATEGORIES = 'Categories'
}

export enum IntegrationTypeNameEnum {
	ALL_INTEGRATIONS = 'All Integrations',
	FOR_SALES_TEAMS = 'For Sales Teams',
	FOR_ACCOUNTANTS = 'For Accountants',
	FOR_SUPPORT_TEAMS = 'For Support Teams',
	CRM = 'CRM',
	SCHEDULING = 'Scheduling',
	TOOLS = 'Tools'
}

export enum IntegrationFilterEnum {
	ALL = 'All',
	FREE = 'Free',
	PAID = 'Paid'
}

export const DEFAULT_INTEGRATION_PAID_FILTERS = [
	{
		label: IntegrationFilterEnum.ALL,
		value: 'all'
	},
	{
		label: IntegrationFilterEnum.FREE,
		value: 'false'
	},
	{
		label: IntegrationFilterEnum.PAID,
		value: 'true'
	}
];

export const DEFAULT_INTEGRATIONS = [
	{
		name: IntegrationEnum.HUBSTAFF,
		imgSrc: 'assets/images/integrations/hubstaff.svg',
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		],
		order: 1
	},
	{
		name: IntegrationEnum.UPWORK,
		imgSrc: 'assets/images/integrations/upwork.svg',
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		],
		order: 2
	},
	{
		name: 'Import/Export',
		imgSrc: 'assets/images/integrations/import-export.svg',
		isComingSoon: true,
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS,
			IntegrationTypeNameEnum.CRM
		],
		order: 3
	}
];
