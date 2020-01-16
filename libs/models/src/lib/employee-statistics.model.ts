import { Employee } from './employee.model';

export interface EmployeeStatisticsFindInput {
	valueDate: Date;
}

export interface EmployeeStatistics {
	expenseStatistics: number[];
	incomeStatistics: number[];
	profitStatistics: number[];
	bonusStatistics: number[];
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
	employee: Employee;
}

export interface AggregatedEmployeeStatistic {
	total: StatisticSum;
	employees: EmployeeStatisticSum[];
}
