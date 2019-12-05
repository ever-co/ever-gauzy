import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Organization extends IBaseEntityModel {
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
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
}

export interface OrganizationFindInput extends IBaseEntityModel {
	name?: string;
	valueDate?: Date;
	imageUrl?: string;
	currency?: CurrenciesEnum;
	isActive?: boolean;
}

export interface OrganizationCreateInput {
	name: string;
	valueDate?: Date;
	imageUrl: string;
	currency: CurrenciesEnum;
	defaultValueDateType: DefaultValueDateTypeEnum;
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
