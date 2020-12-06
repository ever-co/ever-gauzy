import { Connection } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { EmployeeAward } from './employee-award.entity';
import { Tenant } from '../tenant/tenant.entity';
import { DEFAULT_EMPLOYEE_AWARDS } from './default-employee-award';

export const createDefaultEmployeeAwards = async (
	connection: Connection,
	tenant: Tenant,
	employee: Employee
): Promise<EmployeeAward[]> => {
	const awards: EmployeeAward[] = DEFAULT_EMPLOYEE_AWARDS.map(
		({ name, year }) => {
			const award = new EmployeeAward();
			award.name = name;
			award.year = year;
			award.employee = employee;
			award.employeeId = employee.id;
			award.tenant = tenant;
			award.organization = employee.organization;

			return award;
		}
	);

	return await connection.manager.save(awards);
};
