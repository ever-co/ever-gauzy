import { EmployeeBulkCreateHandler } from './employee.bulk.create.handler';
import { EmployeeCreateHandler } from './employee.create.handler';
import { EmployeeGetHandler } from './employee.get.handler';
import { EmployeeUpdateHandler } from './employee.update.handler';
import { UpdateEmployeeTotalWorkedHoursHandler } from './update-employee-total-worked-hours.handler';
import { WorkingEmployeeGetHandler } from './workig-employee.get.handler';

export const CommandHandlers = [
	EmployeeCreateHandler,
	EmployeeBulkCreateHandler,
	EmployeeGetHandler,
	UpdateEmployeeTotalWorkedHoursHandler,
	EmployeeUpdateHandler,
	WorkingEmployeeGetHandler
];
