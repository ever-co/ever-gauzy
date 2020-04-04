import { EmployeeBulkCreateHandler } from './employee.bulk.create.handler';
import { EmployeeCreateHandler } from './employee.create.handler';

export const CommandHandlers = [
	EmployeeCreateHandler,
	EmployeeBulkCreateHandler
];
