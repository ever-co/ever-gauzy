import { Connection } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { EmployeeAward } from './employee-award.entity';
import { Tenant } from '../tenant/tenant.entity';

const MOCK_AWARDS = [
	{ name: 'Microsoft Most Valuable Professional (MVP)', year: '2015' },
	{ name: 'Google Developer Expert (GDE)', year: '2019' },
	{ name: 'Hackatoon Winner', year: '2018' }
];

export const createDefaultEmployeeAwards = async (
	connection: Connection,
	tenant: Tenant,
	employee: Employee
): Promise<EmployeeAward[]> => {
	const awards: EmployeeAward[] = MOCK_AWARDS.map(({ name, year }) => {
		const award = new EmployeeAward();
		award.name = name;
		award.year = year;
		award.employee = employee;
		award.employeeId = employee.id;
		award.tenant = tenant;

		return award;
	});

	return await connection.manager.save(awards);
};
