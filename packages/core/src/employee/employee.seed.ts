import { Tenant } from '../tenant/tenant.entity';
import { Connection } from 'typeorm';
import { Employee } from './employee.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { date as fakerDate } from 'faker';
import { ISeedUsers, PayPeriodEnum } from '@gauzy/contracts';
import * as faker from 'faker';
import { DEFAULT_EMPLOYEES } from './default-employees';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';

export const createDefaultEmployees = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	}
): Promise<Employee[]> => {
	const defaultEmployees = DEFAULT_EMPLOYEES;
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenant = defaultData.tenant;

	const employees: Employee[] = [];
	for (const user of defaultUsers) {
		const employee = new Employee();
		employee.organization = defaultOrg;
		employee.user = user;
		employee.employeeLevel = defaultEmployees.find(
			(e) => e.email === employee.user.email
		).employeeLevel;
		employee.startedWorkOn = getDate(
			defaultEmployees.find((e) => e.email === employee.user.email)
				.startedWorkOn
		);
		employee.endWork = getDate(
			defaultEmployees.find((e) => e.email === employee.user.email)
				.endWork
		);
		// TODO: check below value as its correct or not, and into frontend too
		employee.payPeriod = faker.random.arrayElement(
			Object.keys(PayPeriodEnum)
		);
		employee.billRateValue = faker.random.number(100);
		employee.billRateCurrency = defaultOrg.currency || env.defaultCurrency;
		employee.reWeeklyLimit = faker.random.number(40);
		employee.tenant = defaultTenant;
		employees.push(employee);
	}

	await insertEmployees(connection, employees);
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
		const employees: Employee[] = [];
		const randomUsers = tenantUsersMap.get(tenant).employeeUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);

		for (const organization of randomOrgs) {
			if (randomUsers.length) {
				for (let index = 0; index < employeesPerOrganization; index++) {
					const employee = new Employee();
					employee.organization = organization;
					employee.user = randomUsers.pop();
					employee.isActive = true;
					employee.endWork = null;
					employee.startedWorkOn = new Date(
						moment(fakerDate.past(index % 5)).format(
							'YYYY-MM-DD hh:mm:ss'
						)
					);
					employee.payPeriod = faker.random.arrayElement(
						Object.keys(PayPeriodEnum)
					);
					employee.billRateValue = faker.random.number(100);
					employee.billRateCurrency =
						organization.currency || env.defaultCurrency;
					employee.reWeeklyLimit = faker.random.number(40);
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
): Promise<Employee[]> => {
	return await connection.manager.save(employees);
};

const getDate = (dateString: string): Date => {
	if (dateString) {
		const date = new Date(dateString);
		return date;
	}
	return null;
};
