import { GetEmployeeJobStatisticsHandler } from './handlers/get-employee-job-statistics.handler';
import { UpdateEmployeeJobSearchStatusHandler } from './handlers/update-employee-job-search-status.handler';

export * from './get-employee-job-statistics.command';
export * from './update-employee-job-search-status.command';

export const CommandHandlers = [GetEmployeeJobStatisticsHandler, UpdateEmployeeJobSearchStatusHandler];
