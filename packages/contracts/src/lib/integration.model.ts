import {
	IBaseEntityModel,
	IBasePerTenantAndOrganizationEntityModel,
	IBaseRelationsEntityModel,
	ID
} from './base-entity.model';
import { ITag } from './tag.model';
import { IIntegrationSetting } from './integration-setting.model';

export interface IRelationIntegration {
	integration?: IIntegration;
	integrationId?: ID;
}

export interface IRelationalIntegrationTenant {
	integration?: IIntegrationTenant;
	integrationId?: ID;
}

export interface IIntegrationEntitySetting
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalIntegrationTenant {
	entity: IntegrationEntity;
	sync: boolean;
	tiedEntities?: IIntegrationEntitySettingTied[];
}

export interface IIntegrationEntitySettingTied extends IBasePerTenantAndOrganizationEntityModel {
	entity: IntegrationEntity;
	sync: boolean;
	integrationEntitySetting?: IIntegrationEntitySetting;
	integrationEntitySettingId?: ID;
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

export interface IIntegrationTenantFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IBaseRelationsEntityModel,
		IRelationIntegration {
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
export interface IIntegrationMapSyncBase
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalIntegrationTenant {
	sourceId?: IIntegrationMap['sourceId'];
}

export interface IIntegrationMapSyncEntity<T> extends IIntegrationMapSyncBase {
	entity: T;
}

export interface IIntegrationMapSyncEntityInput extends IIntegrationMapSyncBase {
	gauzyId: ID;
	entity: IntegrationEntity;
}

export interface IIntegrationTenantCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationIntegration {
	name: IntegrationEnum;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export interface IIntegrationTenantUpdateInput extends Partial<IIntegrationTenantCreateInput> {
	id?: ID;
}

export interface IIntegrationMapSyncScreenshot {
	id: number;
	full_url: string;
	thumb_url: string;
	date: string,
	time_slot: string;
	recorded_at: string;
	user_id: number;
	project_id: number;
	offset_x: number;
	offset_y: number;
	width: number;
	height: number;
	screen: number;
	employeeId?: string;
}

export enum IntegrationEnum {
	IMPORT_EXPORT = 'Import_Export',
	UPWORK = 'Upwork',
	HUBSTAFF = 'Hubstaff',
	GAUZY_AI = 'Gauzy_AI',
	GITHUB = 'Github',
	JIRA = 'Jira',
	MAKE_COM = 'Make_Com'
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
	PROPOSAL = 'Proposal',
	/** AI Integration Entity */
	JOB_MATCHING = 'JOB_MATCHING',
	EMPLOYEE_PERFORMANCE = 'EMPLOYEE_PERFORMANCE'
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

export interface IIntegrationAICreateInput extends IBasePerTenantAndOrganizationEntityModel {
	apiKey: string;
	apiSecret: string;
	openAiSecretKey?: string;
	openAiOrganizationId?: string;
}
