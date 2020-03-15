import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tenant } from './tenant.model';
import { Tag } from './tag-entity.model';
import { Location as ILocation } from './location.model';

export interface Organization extends IBaseEntityModel, ILocation {
	name: string;
	valueDate?: Date;
	totalEmployees?: number;
	status?: string;
	imageUrl?: string;
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
	tenant: Tenant;
	invitesAllowed?: boolean;
	inviteExpiryPeriod?: number;
	tags: Tag[];
	futureDateAllowed?: boolean;
}

export interface OrganizationFindInput extends IBaseEntityModel {
	name?: string;
	valueDate?: Date;
	imageUrl?: string;
	currency?: CurrenciesEnum;
	isActive?: boolean;
}

export interface OrganizationCreateInput extends ILocation {
	name: string;
	valueDate?: Date;
	imageUrl: string;
	currency: CurrenciesEnum;
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
}

export enum OrganizationSelectInput {
	id = 'id',
	name = 'name',
	valueDate = 'valueDate',
	imageUrl = 'imageUrl',
	currency = 'currency',
	createdAt = 'createdAt',
	updatedAt = 'updatedAt',
	isActive = 'isActive'
}

export enum RegionsEnum {
	'EN' = 'English (United States)',
	'BG' = 'Bulgarian (Bulgaria)',
	'HE' = 'Hebrew (Israel)',
	'RU' = 'Rusian (Russia)'
}

export enum CurrenciesEnum {
	USD = 'USD',
	BGN = 'BGN',
	ILS = 'ILS'
}

export enum DefaultValueDateTypeEnum {
	TODAY = 'TODAY',
	END_OF_MONTH = 'END_OF_MONTH',
	START_OF_MONTH = 'START_OF_MONTH'
}

export enum ProjectTypeEnum {
	RATE = 'RATE',
	FLAT_FEE = 'FLAT_FEE',
	MILESTONES = 'MILESTONES'
}

export enum AlignmentOptions {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
	CENTER = 'CENTER'
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

export const DEFAULT_PROFIT_BASED_BONUS = 75;
export const DEFAULT_REVENUE_BASED_BONUS = 10;
