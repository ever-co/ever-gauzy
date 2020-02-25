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
}

export interface RecurringExpenseDeleteInput {
	deletionType: RecurringExpenseDeletionEnum;
	month: number;
	year: number;
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
