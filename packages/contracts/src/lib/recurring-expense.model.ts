import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface IRecurringExpenseModel
	extends IBasePerTenantAndOrganizationEntityModel {
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
	employeeId?: string;
	employee?: IEmployee;
}

export interface IRecurringExpenseByMonthFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	month?: number;
	year?: number;
	startDate?: Date;
	endDate?: Date;
}

/**
 * categoryName, value and currency are the new values.
 * startDay, startMonth, startYear represent the date when this was edited.
 */
export interface IRecurringExpenseEditInput {
	startDay: number;
	startMonth: number;
	startYear: number;
	categoryName: string;
	value: number;
	currency: string;
	startDateUpdateType?: string;
}

export interface IRecurringExpenseDeleteInput {
	deletionType: RecurringExpenseDeletionEnum;
	month: number;
	year: number;
}

export interface IRecurringExpenseOrderFields {
	startDate?: 'ASC' | 'DESC';
}

export interface IFindStartDateUpdateTypeInput {
	newStartDate: Date;
	recurringExpenseId: string;
}

export interface IStartUpdateTypeInfo {
	value: StartDateUpdateTypeEnum;
	conflicts: IRecurringExpenseModel[];
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

export enum ComponentType {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION'
}
