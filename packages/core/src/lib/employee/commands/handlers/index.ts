import { EmployeeBulkCreateHandler } from './employee.bulk.create.handler';
import { EmployeeCreateHandler } from './employee.create.handler';
import { EmployeeGetHandler } from './employee.get.handler';
import { EmployeeUpdateHandler } from './employee.update.handler';
import { WorkingEmployeeGetHandler } from './working-employee.get.handler';

export const CommandHandlers = [
	EmployeeCreateHandler,
	EmployeeBulkCreateHandler,
	EmployeeGetHandler,
	EmployeeUpdateHandler,
	WorkingEmployeeGetHandler
];
