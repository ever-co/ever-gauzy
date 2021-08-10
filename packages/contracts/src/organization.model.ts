import { IAccountingTemplate } from './accounting-template.model';
import { IBasePerTenantEntityModel } from './base-entity.model';
import { IContact } from './contact.model';
import { CurrenciesEnum } from './currency.model';
import { IEmployee } from './employee.model';
import { IFeatureOrganization } from './feature.model';
import { IOrganizationAwards } from './organization-awards.model';
import { IOrganizationLanguage } from './organization-language.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { ISkill } from './skill-entity.model';
import { ITag } from './tag-entity.model';
import { ITenant } from './tenant.model';
import { IReportOrganization } from './report.model';

export enum OrganizationPermissionsEnum {
	ALLOW_MANUAL_TIME = 'allowManualTime',
	ALLOW_MODIFY_TIME = 'allowModifyTime',
	ALLOW_DELETE_TIME = 'allowDeleteTime',
	ALLOW_FUTURE_DATE = 'futureDateAllowed'
}

export enum ListsInputTypeEnum {
	DEPARTMENTS = 'DEPARTMENTS',
	POSITIONS = 'POSITIONS',
	VENDORS = 'VENDORS'
}

export interface IOrganization extends IBasePerTenantEntityModel {
	name: string;
	isDefault: boolean;
	profile_link: string;
	valueDate?: Date;
	totalEmployees: number;
	status?: string;
	// Organization logo Url
	imageUrl?: string;
	banner: string;
	short_description: string;
	client_focus: string;
	show_income?: boolean;
	show_profits?: boolean;
	show_bonuses_paid?: boolean;
	show_total_hours?: boolean;
	show_minimum_project_size?: boolean;
	show_projects_count?: boolean;
	show_clients_count?: boolean;
	show_employees_count?: boolean;
	overview: string;
	skills: ISkill[];
	currency: string;
	isActive: boolean;
	defaultValueDateType: string;
	defaultAlignmentType?: string;
	dateFormat?: string;
	brandColor?: string;
	timeZone?: string;
	officialName?: string;
	startWeekOn?: string;
	taxId?: string;
	numberFormat?: string;
	bonusType?: string;
	bonusPercentage?: number;
	employees?: IEmployee[];
	invitesAllowed?: boolean;
	inviteExpiryPeriod?: number;
	tags: ITag[];
	futureDateAllowed?: boolean;
	allowManualTime?: boolean;
	allowModifyTime?: boolean;
	allowDeleteTime?: boolean;
	regionCode?: string;
	requireReason?: boolean;
	requireDescription?: boolean;
	requireProject?: boolean;
	requireTask?: boolean;
	requireClient?: boolean;
	timeFormat?: 12 | 24;
	defaultStartTime?: string;
	defaultEndTime?: string;
	registrationDate?: Date;
	contact: IContact;
	separateInvoiceItemTaxAndDiscount?: boolean;
	organizationSprints?: IOrganizationSprint[];
	minimumProjectSize?: string;
	show_clients?: boolean;
	// "left" and "right" values, used to know where to put currency symbol relative to amount
	currencyPosition?: string;
	website?: string;
	// used in invoice headers to display organization details
	fiscalInformation?: string;
	fiscalStartDate?: Date;
	fiscalEndDate?: Date;
	discountAfterTax?: boolean;
	awards?: IOrganizationAwards[];
	languages?: IOrganizationLanguage[];
	featureOrganizations?: IFeatureOrganization[];
	defaultInvoiceEstimateTerms?: string;
	convertAcceptedEstimates?: boolean;
	daysUntilDue?: number;
	accountingTemplates?: IAccountingTemplate[];
	reportOrganizations?: IReportOrganization[];
}

export interface IOrganizationFindInput extends IBasePerTenantEntityModel {
	id?: string;
	name?: string;
	isDefault?: boolean;
	profile_link?: string;
	valueDate?: Date;
	imageUrl?: string;
	currency?: CurrenciesEnum;
	isActive?: boolean;
	skills?: ISkill[];
	tags?: ITag[];
}

export interface IOrganizationCreateInput extends IContact {
	name: string;
	isDefault: boolean;
	profile_link: string;
	valueDate?: Date;
	imageUrl: string;
	currency: CurrenciesEnum;
	client_focus: string;
	show_income?: boolean;
	show_profits?: boolean;
	show_bonuses_paid?: boolean;
	show_total_hours?: boolean;
	show_minimum_project_size?: boolean;
	show_projects_count?: boolean;
	show_clients_count?: boolean;
	show_employees_count?: boolean;
	defaultValueDateType: DefaultValueDateTypeEnum;
	dateFormat?: string;
	timeZone?: string;
	officialName?: string;
	startWeekOn?: string;
	taxId?: string;
	numberFormat?: string;
	bonusType: BonusTypeEnum;
	bonusPercentage?: number;
	invitesAllowed?: boolean;
	inviteExpiryPeriod?: number;
	tags?: ITag[];
	tenant: ITenant;
	contact?: IContact;
	skills?: ISkill[];
	minimumProjectSize?: string;
	show_clients?: boolean;
	website?: string;
	fiscalInformation?: string;
	defaultInvoiceEstimateTerms?: string;
	convertAcceptedEstimates?: boolean;
	daysUntilDue?: number;
	accountingTemplates?: IAccountingTemplate[];

	isImporting?: boolean;
	sourceId?: string;
	userOrganizationSourceId?: string;
}

export interface IOrganizationUpdateInput extends IOrganizationCreateInput {
	id?: string;
}

export enum OrganizationSelectInput {
	id = 'id',
	name = 'name',
	profile_link = 'profile_link',
	valueDate = 'valueDate',
	imageUrl = 'imageUrl',
	currency = 'currency',
	createdAt = 'createdAt',
	updatedAt = 'updatedAt',
	isActive = 'isActive',
	tags = 'tags'
}

export enum RegionsEnum {
	'EN' = 'English (United States)',
	'BG' = 'Bulgarian (Bulgaria)',
	'HE' = 'Hebrew (Israel)',
	'RU' = 'Rusian (Russia)'
}

export enum DefaultValueDateTypeEnum {
	TODAY = 'TODAY',
	END_OF_MONTH = 'END_OF_MONTH',
	START_OF_MONTH = 'START_OF_MONTH'
}

export enum ProjectBillingEnum {
	RATE = 'RATE',
	FLAT_FEE = 'FLAT_FEE',
	MILESTONES = 'MILESTONES'
}

export enum AlignmentOptions {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
	CENTER = 'CENTER'
}

export enum CurrencyPosition {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT'
}

export enum WeekDaysEnum {
	MONDAY = 'MONDAY',
	TUESDAY = 'TUESDAY',
	WEDNESDAY = 'WEDNESDAY',
	THURSDAY = 'THURSDAY',
	FRIDAY = 'FRIDAY',
	SATURDAY = 'SATURDAY',
	SUNDAY = 'SUNDAY'
}

export enum BonusTypeEnum {
	PROFIT_BASED_BONUS = 'PROFIT_BASED_BONUS',
	REVENUE_BASED_BONUS = 'REVENUE_BASED_BONUS'
}

export enum ClientFocusEnum {
	VERY_SMALL_BUSINESSES = 'Very Small Businesses',
	SMALL_BUSINESSES = 'Small Businesses',
	MEDIUM_BUSINESSES = 'Medium Businesses',
	LARGE_BUSINESSES = 'Large Businesses'
}

export enum ProjectOwnerEnum {
	CLIENT = 'CLIENT',
	INTERNAL = 'INTERNAL'
}

export enum MinimumProjectSizeEnum {
	ONE_THOUSAND = '1000+',
	FIVE_THOUSAND = '5000+',
	TEN_THOUSAND = '10000+',
	TWENTY_FIVE_THOUSAND = '25000+',
	FIFTY_THOUSAND = '50000+',
	ONE_HUNDRED_THOUSAND = '100000+'
}

export const DEFAULT_PROFIT_BASED_BONUS = 75;
export const DEFAULT_REVENUE_BASED_BONUS = 10;
export const DEFAULT_INVITE_EXPIRY_PERIOD = 7;

export interface IOrganizationStoreState {
	organization: IOrganization;
	action: CrudActionEnum;
}

export enum CrudActionEnum {
	CREATED = 'CREATED',
	UPDATED = 'UPDATED',
	DELETED = 'DELETED'
}

export const DEFAULT_DATE_FORMATS: string[] = ['L', 'LL', 'dddd, LL'];
export const DEFAULT_TIME_FORMATS: number[] = [12, 24];
export interface IKeyValuePair {
    key: string;
    value: boolean | string;
}