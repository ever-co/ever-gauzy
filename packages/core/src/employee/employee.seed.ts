import { Connection } from 'typeorm';
import { date as fakerDate } from 'faker';
import {
	IEmployee,
	IOrganization,
	ISeedUsers,
	ITenant,
	IUser,
	PayPeriodEnum
} from '@gauzy/contracts';
import * as faker from 'faker';
import { environment as env } from '@gauzy/config';
import * as moment from 'moment';
import { Employee, Organization } from './../core/entities/internal';
import { getDefaultOrganization } from './../organization/organization.seed';
import { generateSlug } from 'core/utils';

export const createDefaultEmployees = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization,
	users: IUser[],
	defaultEmployees: any
): Promise<Employee[]> => {
	const employees: IEmployee[] = [];
	for (const user of users) {
		const employee = new Employee();
		employee.organization = organization;
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
		employee.billRateValue = faker.datatype.number({ min: 25, max: 50 });
		employee.billRateCurrency = organization.currency || env.defaultCurrency;
		employee.reWeeklyLimit = faker.datatype.number({ min: 25, max: 40 });
		employee.tenant = tenant;
		employee.profile_link = generateSlug(user.firstName+' '+user.lastName);
		employees.push(employee);
	}

	await insertEmployees(connection, employees);
	return employees;
};

export const createRandomEmployees = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, Organization[]>,
	tenantUsersMap: Map<ITenant, ISeedUsers>,
	employeesPerOrganization: number
): Promise<Map<ITenant, IEmployee[]>> => {
	const employeeMap: Map<ITenant, IEmployee[]> = new Map();

	for (const tenant of tenants) {
		const employees: IEmployee[] = [];
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
					employee.billRateValue = faker.datatype.number({ min: 25, max: 50 });
					employee.billRateCurrency =
						organization.currency || env.defaultCurrency;
					employee.reWeeklyLimit = faker.datatype.number({ min: 25, max: 40 });
					employee.tenant = tenant;
					employee.profile_link = generateSlug(employee.user.firstName+' '+employee.user.lastName);

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
	employees: IEmployee[]
): Promise<IEmployee[]> => {
	return await connection.manager.save(employees);
};

const getDate = (dateString: string): Date => {
	if (dateString) {
		const date = new Date(dateString);
		return date;
	}
	return null;
};

/*
 * Default employees
 */
export const getDefaultEmployees = async (
	connection: Connection,
	tenant: ITenant
): Promise<IEmployee[]> => {
	const organization = await getDefaultOrganization(
		connection,
		tenant
	);
	const employees = await connection.getRepository(Employee).find({
		where: {
			tenantId: tenant.id,
			organizationId: organization.id
		},
		relations: ['tenant', 'organization']
	});
	return employees;
};
