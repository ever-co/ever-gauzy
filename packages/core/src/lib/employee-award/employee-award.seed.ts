import { DataSource } from 'typeorm';
import { EmployeeAward } from './employee-award.entity';
import { DEFAULT_EMPLOYEE_AWARDS } from './default-employee-awards';
import { IEmployee, ITenant } from '@gauzy/contracts';

export const createDefaultEmployeeAwards = async (
	dataSource: DataSource,
	tenant: ITenant,
	employee: IEmployee
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

	return await dataSource.manager.save(awards);
};
