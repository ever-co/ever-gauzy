import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EmployeeRecurringExpense extends IBaseEntityModel {
	employeeId: string;
	month: number;
	year: number;
	categoryName: string;
	value: number;
	currency: string;
	isRecurring: boolean;
}

export interface EmployeeRecurringExpenseFindInput extends IBaseEntityModel {
	employeeId?: string;
	month?: number;
	year?: number;
	currency?: string;
	isRecurring?: boolean;
}
