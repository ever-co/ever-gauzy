import { Employee } from './employee.model';
import { User } from './user.model';

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
	expense: number;
	income: number;
	profit: number;
	bonus: number;
}

export interface MonthAggregatedSplitExpense {
	month: number;
	year: number;
	splitExpense: number;
	splitAmong: number;
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
