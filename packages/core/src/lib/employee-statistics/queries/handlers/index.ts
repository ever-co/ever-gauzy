import { AggregateOrganizationQueryHandler } from './aggregate-employee-statistic.handler';
import { MonthAggregatedEmployeeStatisticsQueryHandler } from './month-aggregated-employee-statistics.handler';
import { EmployeeStatisticsHistoryQueryHandler } from './employee-statistics-history.handler';

export const QueryHandlers = [
	AggregateOrganizationQueryHandler,
	MonthAggregatedEmployeeStatisticsQueryHandler,
	EmployeeStatisticsHistoryQueryHandler
];
