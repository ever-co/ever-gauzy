import { EmployeeBulkCreateHandler } from './employee.bulk.create.handler';
import { EmployeeCreateHandler } from './employee.create.handler';
import { EmployeeGetHandler } from './employee.get.handler';
import { GetEmployeeJobStatisticsHandler } from './get-employee-job-statistics.handler';
import { UpdateEmployeeJobSearchStatusHandler } from './update-employee-job-search-status.handler';
import { UpdateEmployeeTotalWorkedHoursHandler } from './update-employee-total-worked-hours.handler';

export const CommandHandlers = [
	EmployeeCreateHandler,
	EmployeeBulkCreateHandler,
	EmployeeGetHandler,
	UpdateEmployeeTotalWorkedHoursHandler,
	UpdateEmployeeJobSearchStatusHandler,
	GetEmployeeJobStatisticsHandler
];
