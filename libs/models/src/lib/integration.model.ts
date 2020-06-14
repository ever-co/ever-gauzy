import { SafeResourceUrl } from '@angular/platform-browser';
import { ITenant } from './tenant.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjectsCreateInput } from '..';

export interface IIntegrationSetting {
	integration: IIntegrationTenant;
	settingsName: string;
	settingsValue: string;
}

export interface IIntegrationEntitySetting {
	// integration: IIntegration;
	entity: string;
	sync: boolean;
	tiedEntities?: any[];
}

export interface IIntegrationMap {
	integration: IIntegrationTenant;
	sourceId: string;
	gauzyId: string;
}

export interface IIntegrationViewModel {
	title: string;
	imgSrc: string | SafeResourceUrl;
	navigation_url: string;
	isComingSoon?: boolean;
}

export interface IIntegrationTenant extends IBaseEntityModel {
	tenant: ITenant;
	name: string;
	entitySettings?: IIntegrationEntitySetting[];
}

export interface IIntegration extends IBaseEntityModel {
	name: string;
	imgSrc?: string;
	integrationTypes?: IIntegrationType[];
}

export interface IIntegrationType extends IBaseEntityModel {
	name: string;
	groupName: string;
	order: number;
}

export interface IIntegrationFilter {
	integrationTypeId: string;
	searchQuery: string;
}

export interface IIntegrationMapSyncProject {
	organizationProjectCreateInput: OrganizationProjectsCreateInput;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncEntityInput {
	integrationId: string;
	sourceId: string;
	gauzyId: string;
	entity: string;
}

export interface IIntegrationTenantCreateDto {
	name: string;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: any[];
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
	TIME_SLOT = 'TimeSlot'
}

export enum IntegrationTypeGroupEnum {
	FEATURED = 'Featured',
	CATEGORIES = 'Categories'
}

export enum IntegrationTypeNameEnum {
	ALL_INTEGRATIONS = 'All Integrations',
	FOR_SALES_TEAMS = 'For Sales Teams',
	CRM = 'CRM',
	SCHEDULING = 'Scheduling',
	TOOLS = 'Tools'
}
