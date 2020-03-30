import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface RecurringExpenseModel extends IBaseEntityModel {
	startDay: number;
	startMonth: number;
	startYear: number;
	startDate: Date;
	endDay?: number;
	endMonth?: number;
	endYear?: number;
	endDate?: Date;
	categoryName: string;
	value: number;
	currency: string;
	parentRecurringExpenseId?: string;
}

export interface RecurringExpenseByMonthFindInput extends IBaseEntityModel {
	employeeId?: string;
	orgId?: string;
	month?: number;
	year?: number;
}

/**
 * categoryName, value and currency are the new values.
 * startDay, startMonth, startYear represent the date when this was edited.
 */
export interface RecurringExpenseEditInput extends IBaseEntityModel {
	startDay: number;
	startMonth: number;
	startYear: number;
	categoryName: string;
	value: number;
	currency: string;
	startDateUpdateType?: string;
}

export interface RecurringExpenseDeleteInput {
	deletionType: RecurringExpenseDeletionEnum;
	month: number;
	year: number;
}

export interface RecurringExpenseOrderFields {
	startDate?: 'ASC' | 'DESC';
}

export interface IFindStartDateUpdateTypeInput {
	newStartDate: Date;
	recurringExpenseId: string;
}

export interface IStartUpdateTypeInfo {
	value: StartDateUpdateTypeEnum;
	conflicts: RecurringExpenseModel[];
}

export enum RecurringExpenseDeletionEnum {
	CURRENT = 'current',
	FUTURE = 'future',
	ALL = 'all'
}

export enum RecurringExpenseDefaultCategoriesEnum {
	SALARY = 'SALARY',
	SALARY_TAXES = 'SALARY_TAXES',
	RENT = 'RENT',
	EXTRA_BONUS = 'EXTRA_BONUS'
}

export enum StartDateUpdateTypeEnum {
	REDUCE_SAFE = 'REDUCE_SAFE',
	REDUCE_CONFLICT = 'REDUCE_CONFLICT',
	INCREASE_SAFE_WITHIN_LIMIT = 'INCREASE_SAFE_WITHIN_LIMIT',
	INCREASE_SAFE_OUTSIDE_LIMIT = 'INCREASE_SAFE_OUTSIDE_LIMIT',
	INCREASE_CONFLICT = 'INCREASE_CONFLICT',
	WITHIN_MONTH = 'WITHIN_MONTH',
	NO_CHANGE = 'NO_CHANGE'
}
