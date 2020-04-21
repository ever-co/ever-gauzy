import { User } from './user.model';
import { Expense } from './expense.model';
import { OrganizationRecurringExpense } from './organization-recurring-expense.model';

export interface EmployeeStatisticsFindInput {
	valueDate: Date;
}

export interface EmployeeStatistics {
	expenseStatistics: number[];
	incomeStatistics: number[];
	profitStatistics: number[];
	bonusStatistics: number[];
}
export interface MonthAggregatedEmployeeStatisticsFindInput {
	employeeId: string;
	valueDate: Date;
	months: number;
}

export interface MonthAggregatedEmployeeStatistics {
	month: number;
	year: number;
	income: number;
	expenseWithoutSalary: number;
	expense: number;
	profit: number;
	bonus: number;
	directIncomeBonus: number;
}

export interface MonthAggregatedSplitExpense {
	month: number;
	year: number;
	expense?: Expense[];
	recurringExpense?: OrganizationRecurringExpense[];
	splitExpense: number;
	splitAmong: number;
	valueDate?: Date;
}

export interface AggregatedEmployeeStatisticFindInput {
	organizationId: string;
	filterDate: Date;
}

export interface StatisticSum {
	expense: number;
	income: number;
	profit: number;
	bonus: number;
}

export interface EmployeeStatisticSum extends StatisticSum {
	employee: {
		id: string;
		user: User;
	};
}

export interface AggregatedEmployeeStatistic {
	total: StatisticSum;
	employees: EmployeeStatisticSum[];
}

export enum EmployeeStatisticsHistoryEnum {
	INCOME = 'INCOME',
	EXPENSES = 'EXPENSES',
	EXPENSES_WITHOUT_SALARY = 'EXPENSES_WITHOUT_SALARY',
	NON_BONUS_INCOME = 'NON_BONUS_INCOME',
	BONUS_INCOME = 'BONUS_INCOME',
	PROFIT = 'PROFIT'
}

export interface EmployeeStatisticsHistory {
	valueDate: Date;
	amount: number;
	notes?: string;
	vendorName?: string;
	clientName?: string;
	categoryName?: string;
	isRecurring?: boolean;
	isBonus?: boolean;
	isSalary?: boolean;
	source?: 'employee' | 'org';
	splitExpense?: SplitExpense;
}
export interface SplitExpense {
	originalValue: number;
	employeeCount: number;
}

export interface EmployeeStatisticsHistoryFindInput
	extends MonthAggregatedEmployeeStatisticsFindInput {
	type: EmployeeStatisticsHistoryEnum;
}
