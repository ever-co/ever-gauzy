import { Tenant } from '../tenant/tenant.entity';
import { Connection } from 'typeorm';
import { Employee } from './employee.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { environment as env } from '@env-api/environment';
import { date as fakerDate } from 'faker';
import { ISeedUsers } from '@gauzy/models';

export const createDefaultEmployees = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	}
): Promise<Employee[]> => {
	const defaultEmployees = env.defaultEmployees || [];
	let employee: Employee;
	const employees: Employee[] = [];
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenant = defaultData.tenant;

	let counter = 0;
	for (const user of defaultUsers) {
		employee = new Employee();
		employee.organization = defaultOrg;
		employee.user = user;
		employee.tenant = defaultTenant;
		employee.employeeLevel = defaultEmployees.filter(
			(e) => e.email === employee.user.email
		)[0].employeeLevel;
		employee.startedWorkOn = getDate(
			defaultEmployees.filter((e) => e.email === employee.user.email)[0]
				.startedWorkOn
		);
		employee.endWork = getDate(
			defaultEmployees.filter((e) => e.email === employee.user.email)[0]
				.endWork
		);
		await insertEmployee(connection, employee);
		employees.push(employee);
		counter++;
	}

	return employees;
};

export const createRandomEmployees = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantUsersMap: Map<Tenant, ISeedUsers>,
	employeesPerOrganization: number
): Promise<Map<Tenant, Employee[]>> => {
	const employeeMap: Map<Tenant, Employee[]> = new Map();

	for (const tenant of tenants) {
		let employee: Employee;
		const employees: Employee[] = [];
		const randomUsers = tenantUsersMap.get(tenant).employeeUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);

		for (const organization of randomOrgs) {
			if (randomUsers.length) {
				for (let index = 0; index < employeesPerOrganization; index++) {
					employee = new Employee();
					employee.organization = organization;
					employee.user = randomUsers.pop();
					employee.isActive = true;
					employee.endWork = null;
					employee.startedWorkOn = fakerDate.past(index % 5);
					employee.tenant = tenant;

					if (employee.user) {
						employees.push(employee);
					}
				}
			}
		}
		employeeMap.set(tenant, employees);
		await insertEmployees(connection, employees);
	}

	return employeeMap;
};

const insertEmployees = async (
	connection: Connection,
	employees: Employee[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Employee)
		.values(employees)
		.execute();
};

const insertEmployee = async (
	connection: Connection,
	employee: Employee
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Employee)
		.values(employee)
		.execute();
};

const getDate = (dateString: string): Date => {
	if (dateString) {
		const date = new Date(dateString);
		return date;
	}
	return null;
};
