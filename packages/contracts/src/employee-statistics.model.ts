import { IUser } from './user.model';
import { IExpense } from './expense.model';
import { IOrganizationRecurringExpense } from './organization-recurring-expense.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationContact } from './organization-contact.model';

export interface IEmployeeStatisticsFindInput {
	valueDate: Date;
}

export interface IEmployeeStatistics {
	expenseStatistics: number[];
	incomeStatistics: number[];
	profitStatistics: number[];
	bonusStatistics: number[];
}
export interface IMonthAggregatedEmployeeStatisticsFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: string;
	valueDate: Date;
	months: number;
}

export interface IMonthAggregatedEmployeeStatistics {
	month: number;
	year: number;
	income: number;
	expenseWithoutSalary: number;
	expense: number;
	profit: number;
	bonus: number;
	directIncomeBonus: number;
}

export interface IMonthAggregatedSplitExpense {
	month: number;
	year: number;
	expense?: IExpense[];
	recurringExpense?: IOrganizationRecurringExpense[];
	splitExpense: number;
	splitAmong: number;
	valueDate?: Date;
}

export interface IAggregatedEmployeeStatisticFindInput {
	organizationId: string;
	tenantId: string;
	filterDate: Date;
}

export interface IStatisticSum {
	expense: number;
	income: number;
	profit: number;
	bonus: number;
}

export interface IEmployeeStatisticSum extends IStatisticSum {
	employee: {
		id: string;
		user: IUser;
	};
}

export interface IAggregatedEmployeeStatistic {
	total: IStatisticSum;
	employees: IEmployeeStatisticSum[];
}

export enum EmployeeStatisticsHistoryEnum {
	INCOME = 'INCOME',
	EXPENSES = 'EXPENSES',
	EXPENSES_WITHOUT_SALARY = 'EXPENSES_WITHOUT_SALARY',
	NON_BONUS_INCOME = 'NON_BONUS_INCOME',
	BONUS_INCOME = 'BONUS_INCOME',
	PROFIT = 'PROFIT'
}

export interface IEmployeeStatisticsHistory {
	valueDate: Date;
	amount: number;
	notes?: string;
	vendorName?: string;
	client?: IOrganizationContact;
	categoryName?: string;
	isRecurring?: boolean;
	isBonus?: boolean;
	isSalary?: boolean;
	source?: 'employee' | 'org';
	splitExpense?: ISplitExpense;
}
export interface ISplitExpense {
	originalValue: number;
	employeeCount: number;
}

export interface IEmployeeStatisticsHistoryFindInput
	extends IMonthAggregatedEmployeeStatisticsFindInput {
	type: EmployeeStatisticsHistoryEnum;
}
