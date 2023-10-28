import { IBaseEntityModel, IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag.model';

export interface IRelationIntegration {
	integration?: IIntegration;
	integrationId?: IIntegration['id'];
}

export interface IRelationalIntegrationTenant {
	integration?: IIntegrationTenant;
	integrationId?: IIntegrationTenant['id'];
}

export interface IIntegrationSetting extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
	settingsName: string;
	settingsValue: string;
}

export interface IIntegrationEntitySetting extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
	entity: IntegrationEntity;
	sync: boolean;
	tiedEntities?: IIntegrationEntitySettingTied[];
}

export interface IIntegrationEntitySettingTied extends IBasePerTenantAndOrganizationEntityModel {
	entity: IntegrationEntity;
	sync: boolean;
	integrationEntitySetting?: IIntegrationEntitySetting;
	integrationEntitySettingId?: IIntegrationEntitySetting['id'];
}

export interface IIntegrationMap extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
	sourceId: string;
	gauzyId: string;
}

export interface IIntegrationViewModel {
	name: string;
	imgSrc: string;
	navigation_url: string;
	isComingSoon?: boolean;
}

export interface IIntegrationTenant extends IBasePerTenantAndOrganizationEntityModel, IRelationIntegration {
	name: IntegrationEnum;
	lastSyncedAt?: Date;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export interface IIntegrationTenantFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationIntegration {
	name?: IntegrationEnum;
}

export interface IIntegration extends IBaseEntityModel {
	name: string;
	imgSrc: string;
	isComingSoon?: boolean;
	isPaid?: boolean;
	version?: string;
	docUrl?: string;
	provider?: string;
	redirectUrl?: string;
	isFreeTrial?: boolean;
	freeTrialPeriod?: number;
	order?: number;
	integrationTypes?: IIntegrationType[];
	tags?: ITag[];
	fullImgUrl?: string;
}

export interface IIntegrationType extends IBaseEntityModel {
	name: string;
	description: string;
	icon: string;
	groupName: string;
	order: number;
	integrations: IIntegration[];
}

export interface IIntegrationFilter {
	integrationTypeId: string;
	searchQuery: string;
	filter: string;
}

/** */
export interface IIntegrationMapSyncBase extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
	sourceId?: IIntegrationMap['sourceId'];
}

export interface IIntegrationMapSyncEntity<T> extends IIntegrationMapSyncBase {
	entity: T;
}

export interface IIntegrationMapSyncEntityInput extends IIntegrationMapSyncBase {
	gauzyId: IIntegrationMap['gauzyId'];
	entity: IntegrationEntity;
}

export interface IIntegrationTenantCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationIntegration {
	name: IntegrationEnum;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export interface IIntegrationTenantUpdateInput extends IIntegrationTenantCreateInput {
	id?: IIntegrationTenant['id'];
}

export enum IntegrationEnum {
	IMPORT_EXPORT = 'Import_Export',
	UPWORK = 'Upwork',
	HUBSTAFF = 'Hubstaff',
	GAUZY_AI = 'Gauzy_AI',
	GITHUB = 'Github',
	JIRA = 'Jira'
}

export enum IntegrationEntity {
	PROJECT = 'Project',
	ORGANIZATION = 'Organization',
	NOTE = 'Note',
	CLIENT = 'Client',
	TASK = 'Task',
	ISSUE = 'Issue',
	LABEL = 'Label',
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

export enum IntegrationTypeEnum {
	ALL_INTEGRATIONS = 'All Integrations',
	FOR_SALES_TEAMS = 'For Sales Teams',
	FOR_ACCOUNTANTS = 'For Accountants',
	FOR_SUPPORT_TEAMS = 'For Support Teams',
	CRM = 'CRM',
	SCHEDULING = 'Scheduling',
	TOOLS = 'Tools',
	PROJECT_MANAGEMENT = 'Project Management',
	COMMUNICATION = 'Communication'
}

export enum IntegrationFilterEnum {
	ALL = 'All',
	FREE = 'Free',
	PAID = 'Paid'
}

/**
* Hubstaff Integration
*/
export interface IEntitySettingToSync {
	previousValue: IIntegrationEntitySetting[];
	currentValue: IIntegrationEntitySetting[];
}

export interface IDateRangeActivityFilter {
	start: Date;
	end: Date;
}

export interface IIntegrationKeySecretPairInput extends IBasePerTenantAndOrganizationEntityModel {
	client_id: string;
	client_secret: string;
}
