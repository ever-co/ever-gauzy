import { SafeResourceUrl } from '@angular/platform-browser';
import {
	IBaseEntityModel,
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantEntityModel
} from './base-entity.model';
import { IOrganizationProjectsCreateInput } from './organization-projects.model';
import { ITag } from './tag-entity.model';

export interface IIntegrationSetting
	extends IBasePerTenantAndOrganizationEntityModel {
	integration?: IIntegrationTenant;
	settingsName: string;
	settingsValue: string;
}

export interface IIntegrationEntitySetting
	extends IBasePerTenantAndOrganizationEntityModel {
	integration?: IIntegrationTenant;
	readonly integrationId?: string;
	entity: string;
	sync: boolean;
	tiedEntities?: any[];
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
	imgSrc: string | SafeResourceUrl;
	navigation_url: string;
	isComingSoon?: boolean;
}

export interface IIntegrationTenant extends IBasePerTenantEntityModel {
	name: string;
	entitySettings?: IIntegrationEntitySetting[];
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

export interface IIntegrationTenantCreateDto extends IBasePerTenantEntityModel {
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
