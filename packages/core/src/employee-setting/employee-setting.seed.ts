import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { environment as env } from '@gauzy/config';
import { EmployeeSetting } from './employee-setting.entity';

export const createRandomEmployeeSetting = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<EmployeeSetting[]> => {
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Employee settings  will not be created'
		);
		return;
	}

	const employees: EmployeeSetting[] = [];
	const setting = ['Normal', 'Custom'];

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			for await (const tenantEmployee of tenantEmployees) {
				const employee = new EmployeeSetting();
				const startDate = faker.date.past();

				employee.employeeId = tenantEmployee.id;
				employee.month = startDate.getMonth() + 1;
				employee.year = startDate.getFullYear();
				employee.settingType = setting[Math.random() > 0.5 ? 1 : 0];
				employee.value = Math.floor(Math.random() * 999) + 1;
				employee.currency = env.defaultCurrency;
				employee.employee = tenantEmployee;
				employee.organization = faker.helpers.arrayElement(organizations);
				employee.tenant = tenant;
				employees.push(employee);
			}
		}
	}
	await insertRandomEmployeeSetting(dataSource, employees);
	return employees;
};

const insertRandomEmployeeSetting = async (
	dataSource: DataSource,
	Employees: EmployeeSetting[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(EmployeeSetting)
		.values(Employees)
		.execute();
};
