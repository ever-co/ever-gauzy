import { EmployeeBulkCreateHandler } from './employee.bulk.create.handler';
import { EmployeeCreateHandler } from './employee.create.handler';
import { EmployeeGetHandler } from './employee.get.handler';

export const CommandHandlers = [
	EmployeeCreateHandler,
	EmployeeBulkCreateHandler,
	EmployeeGetHandler
];
