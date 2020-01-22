import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EmployeeRecurringExpense extends IBaseEntityModel {
	employeeId: string;
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

/**
 * categoryName, value and currency are the new values.
 * startDay, startMonth, startYear represent the date when this was edited.
 */
export interface EmployeeRecurringExpenseEditInput extends IBaseEntityModel {
	startDay: number;
	startMonth: number;
	startYear: number;
	categoryName: string;
	value: number;
	currency: string;
}

export interface EmployeeRecurringExpenseByMonthFindInput
	extends IBaseEntityModel {
	employeeId?: string;
	month?: number;
	year?: number;
}

export interface EmployeeRecurringExpenseDeleteInput {
	deletionType: RecurringExpenseDeletionEnum;
	month: number;
	year: number;
}

export enum RecurringExpenseDeletionEnum {
	CURRENT = 'current',
	FUTURE = 'future',
	ALL = 'all'
}
