import { IHubstaffScreenshotActivity, IHubstaffTimeSlotActivity } from './hubstaff.model';
import { IOrganizationUpdateInput, ITaskUpdateInput } from './index';
import { IActivity, ITimeLog } from './timesheet.model';
import {
	IBaseEntityModel,
	IBasePerTenantAndOrganizationEntityModel
} from './base-entity.model';
import { IOrganizationProjectsUpdateInput } from './organization-projects.model';
import { ITag } from './tag.model';

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
	sourceId: number;
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

export interface IIntegration extends IBaseEntityModel {
	name: string;
	imgSrc: string;
	isComingSoon?: boolean;
	isPaid?: boolean;
	version?: string;
	docUrl?: string;
	navigationUrl?: string;
	isFreeTrial?: boolean;
	freeTrialPeriod?: number;
	order?: number;
	integrationTypes?: IIntegrationType[];
	tags?: ITag[];
	fullImgUrl?: string;
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

export interface IIntegrationMapSyncActivity
	extends IBasePerTenantAndOrganizationEntityModel {
	activity: IActivity;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncScreenshot
	extends IBasePerTenantAndOrganizationEntityModel {
	screenshot: IHubstaffScreenshotActivity;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncTimeLog
	extends IBasePerTenantAndOrganizationEntityModel {
	timeLog: Partial<ITimeLog>;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncTimeSlot
	extends IBasePerTenantAndOrganizationEntityModel {
	timeSlot: IHubstaffTimeSlotActivity;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncTask
	extends IBasePerTenantAndOrganizationEntityModel {
	taskInput: ITaskUpdateInput;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncProject
	extends IBasePerTenantAndOrganizationEntityModel {
	organizationProjectInput: IOrganizationProjectsUpdateInput;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncOrganization
	extends IBasePerTenantAndOrganizationEntityModel {
	organizationInput: IOrganizationUpdateInput;
	integrationId: string;
	sourceId: number;
}

export interface IIntegrationMapSyncEntityInput
	extends IBasePerTenantAndOrganizationEntityModel {
	integrationId: string;
	sourceId: number;
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
	HUBSTAFF = 'Hubstaff',
	GAUZY_AI = 'Gauzy AI'
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
		imgSrc: 'hubstaff.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		],
		order: 1,
		navigationUrl: 'hubstaff'
	},
	{
		name: IntegrationEnum.UPWORK,
		imgSrc: 'upwork.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		],
		order: 2,
		navigationUrl: 'upwork'
	},
	{
		name: IntegrationEnum.GAUZY_AI,
		imgSrc: 'ever-ai.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		],
		order: 3,
		navigationUrl: 'ever-ai'
	},
	{
		name: 'Import/Export',
		imgSrc: 'import-export.svg',
		isComingSoon: true,
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS,
			IntegrationTypeNameEnum.CRM
		],
		order: 4,
		navigationUrl: 'import-export'
	}
];

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
