import { DataSource } from 'typeorm';
import {
	IEmployee,
	IOrganization,
	ISeedUsers,
	ITenant,
	IUser,
	PayPeriodEnum
} from '@gauzy/contracts';
import { faker } from '@ever-co/faker';
import { environment as env } from '@gauzy/config';
import * as moment from 'moment';
import { Employee, Organization } from './../core/entities/internal';
import { getDefaultOrganization } from './../organization/organization.seed';

export const createDefaultEmployees = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	users: IUser[],
	defaultEmployees: any
): Promise<IEmployee[]> => {
	const employees: IEmployee[] = [];
	for (const user of users) {
		const employee = new Employee();
		employee.organization = organization;
		employee.tenant = tenant;
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
		employee.billRateValue = faker.datatype.number({ min: 15, max: 40 });
		employee.billRateCurrency = organization.currency || env.defaultCurrency;
		employee.reWeeklyLimit = faker.datatype.number({ min: 10, max: 40 });
		employees.push(employee);
	}

	await insertEmployees(dataSource, employees);
	return employees;
};

export const createRandomEmployees = async (
	dataSource: DataSource,
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
					employee.tenant = tenant;
					employee.user = randomUsers.pop();
					employee.isActive = true;
					employee.endWork = null;
					employee.startedWorkOn = new Date(
						moment(faker.date.past(index % 5)).format(
							'YYYY-MM-DD hh:mm:ss'
						)
					);
					employee.payPeriod = faker.random.arrayElement(
						Object.keys(PayPeriodEnum)
					);
					employee.billRateValue = faker.datatype.number({ min: 15, max: 40 });
					employee.billRateCurrency = organization.currency || env.defaultCurrency;
					employee.reWeeklyLimit = faker.datatype.number({ min: 10, max: 40 });
					if (employee.user) {
						employees.push(employee);
					}
				}
			}
		}
		employeeMap.set(tenant, employees);
		await insertEmployees(dataSource, employees);
	}

	return employeeMap;
};

const insertEmployees = async (
	dataSource: DataSource,
	employees: IEmployee[]
): Promise<IEmployee[]> => {
	return await dataSource.manager.save(employees);
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
	dataSource: DataSource,
	tenant: ITenant
): Promise<IEmployee[]> => {
	const organization = await getDefaultOrganization(
		dataSource,
		tenant
	);
	const employees = await dataSource.getRepository(Employee).find({
		where: {
			tenantId: tenant.id,
			organizationId: organization.id
		},
		relations: ['tenant', 'organization']
	});
	return employees;
};
