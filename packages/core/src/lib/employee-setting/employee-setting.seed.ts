import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { EmployeeSetting } from './employee-setting.entity';

export const createRandomEmployeeSetting = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<EmployeeSetting[]> => {
	if (!organizationEmployeesMap) {
		console.warn('Warning: organizationEmployeesMap not found, Employee settings  will not be created');
		return;
	}

	const employees: EmployeeSetting[] = [];

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			for await (const tenantEmployee of tenantEmployees) {
				const employee = new EmployeeSetting();

				employee.employeeId = tenantEmployee.id;
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

const insertRandomEmployeeSetting = async (dataSource: DataSource, Employees: EmployeeSetting[]) => {
	await dataSource.createQueryBuilder().insert().into(EmployeeSetting).values(Employees).execute();
};
