import { IHubstaffScreenshotActivity, IHubstaffTimeSlotActivity } from './hubstaff.model';
import { IActivity, ITimeLog } from './timesheet.model';
import {
	IBaseEntityModel,
	IBasePerTenantAndOrganizationEntityModel
} from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganizationCreateInput, IOrganizationUpdateInput } from './organization.model';
import { ITaskUpdateInput } from './task.model';
import { ITag } from './tag.model';

export interface IRelationalIntegrationTenant {
	integration?: IIntegrationTenant;
	integrationId?: IIntegrationTenant['id'];
}

export interface IIntegrationSetting extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
	settingsName: string;
	settingsValue: string;
}

export interface IIntegrationEntitySetting extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
	entity: string;
	sync: boolean;
	tiedEntities?: IIntegrationEntitySettingTied[];
}

export interface IIntegrationEntitySettingTied extends IBasePerTenantAndOrganizationEntityModel {
	entity: string;
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

export interface IIntegrationTenant extends IBasePerTenantAndOrganizationEntityModel {
	name: IntegrationEnum;
	integration?: IIntegration;
	integrationId?: IIntegration['id'];
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export interface IIntegrationTenantFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: IntegrationEnum;
	integrationId?: IIntegration['id'];
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

export interface IIntegrationMapSyncActivity extends IBasePerTenantAndOrganizationEntityModel {
	activity: IActivity;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncScreenshot extends IBasePerTenantAndOrganizationEntityModel {
	screenshot: IHubstaffScreenshotActivity;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncTimeLog extends IBasePerTenantAndOrganizationEntityModel {
	timeLog: Partial<ITimeLog>;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncTimeSlot extends IBasePerTenantAndOrganizationEntityModel {
	timeSlot: IHubstaffTimeSlotActivity;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncTask extends IBasePerTenantAndOrganizationEntityModel {
	taskInput: ITaskUpdateInput;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncProject extends IBasePerTenantAndOrganizationEntityModel {
	organizationProject: IOrganizationProject;
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncOrganization extends IBasePerTenantAndOrganizationEntityModel {
	organizationInput: IOrganizationCreateInput | IOrganizationUpdateInput,
	integrationId: string;
	sourceId: string;
}

export interface IIntegrationMapSyncEntityInput extends IBasePerTenantAndOrganizationEntityModel {
	integrationId: string;
	sourceId: string;
	gauzyId: string;
	entity: string;
}

export interface IIntegrationTenantCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	integration?: IIntegration;
	integrationId?: IIntegration['id'];
	name: IntegrationEnum;
	entitySettings?: IIntegrationEntitySetting[];
	settings?: IIntegrationSetting[];
}

export interface IIntegrationTenantUpdateInput extends Pick<IIntegrationTenantCreateInput, 'entitySettings' | 'settings'> { }

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
	PROJECT_MANAGEMENT = ' Project Management',
	// COMMUNICATION = 'Communication'
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
