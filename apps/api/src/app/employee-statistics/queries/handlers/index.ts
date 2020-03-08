import { AggregateOrganizationQueryHandler } from './aggregate-employee-statistic.handler';
import { MonthAggregatedEmployeeStatisticsQueryHandler } from './month-aggregated-employee-statistics.handler';

export const QueryHandlers = [
	AggregateOrganizationQueryHandler,
	MonthAggregatedEmployeeStatisticsQueryHandler
];
