import { Connection } from 'typeorm';
import { IEmployee, ITenant } from '@gauzy/contracts';
import * as faker from 'faker';
import { environment as env } from '@gauzy/config';
import { Organization } from '../organization/organization.entity';
import { EmployeeSetting } from './employee-setting.entity';

export const createRandomEmployeeSetting = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>
): Promise<EmployeeSetting[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, Employee settings  will not be created'
		);
		return;
	}

	const employees: EmployeeSetting[] = [];
	const setting = ['Normal', 'Custom'];

	for (const tenant of tenants) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const tenantEmployee of tenantEmployees) {
			const employee = new EmployeeSetting();
			const startDate = faker.date.past();

			employee.employeeId = tenantEmployee.id;
			employee.month = startDate.getMonth() + 1;
			employee.year = startDate.getFullYear();
			employee.settingType = setting[Math.random() > 0.5 ? 1 : 0];
			employee.value = Math.floor(Math.random() * 999) + 1;
			employee.currency = env.defaultCurrency ;
			employee.employee = tenantEmployee;
			employee.organization = faker.random.arrayElement(organizations);
			employee.tenant = tenant;
			employees.push(employee);
		}
	}
	await insertRandomEmployeeSetting(connection, employees);
	return employees;
};

const insertRandomEmployeeSetting = async (
	connection: Connection,
	Employees: EmployeeSetting[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmployeeSetting)
		.values(Employees)
		.execute();
};
