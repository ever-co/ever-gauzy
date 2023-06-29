import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant, IUser, PayPeriodEnum } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { environment as env } from '@gauzy/config';
import * as moment from 'moment';
import { Employee } from './../core/entities/internal';
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
		employee.employeeLevel = defaultEmployees.find((e) => e.email === employee.user.email).employeeLevel;
		employee.startedWorkOn = getDate(defaultEmployees.find((e) => e.email === employee.user.email).startedWorkOn);
		employee.endWork = getDate(defaultEmployees.find((e) => e.email === employee.user.email).endWork);
		// TODO: check below value as its correct or not, and into frontend too
		employee.payPeriod = faker.helpers.arrayElement(Object.keys(PayPeriodEnum));
		employee.billRateValue = faker.number.int({ min: 15, max: 40 });
		employee.billRateCurrency = organization.currency || env.defaultCurrency;
		employee.minimumBillingRate = faker.number.int({ min: 5, max: employee.billRateValue - 1 });
		employee.reWeeklyLimit = faker.number.int({ min: 10, max: 40 });
		employees.push(employee);
	}
	await insertEmployees(dataSource, employees);
	return employees;
};

export const createRandomEmployees = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationUsersMap: Map<IOrganization, IUser[]>
): Promise<Map<IOrganization, IEmployee[]>> => {
	const organizationEmployeesMap: Map<IOrganization, IEmployee[]> = new Map();
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const employees: IEmployee[] = [];
			const users = organizationUsersMap.get(organization);
			for await (const user of users) {
				const employee = new Employee();
				employee.organization = organization;
				employee.tenant = tenant;
				employee.user = user;
				employee.isActive = true;
				employee.endWork = null;
				employee.startedWorkOn = new Date(moment(faker.date.past()).format('YYYY-MM-DD hh:mm:ss'));
				employee.payPeriod = faker.helpers.arrayElement(Object.keys(PayPeriodEnum));
				employee.billRateValue = faker.number.int({ min: 15, max: 40 });
				employee.billRateCurrency = organization.currency || env.defaultCurrency;
				employee.reWeeklyLimit = faker.number.int({ min: 10, max: 40 });
				employees.push(employee);
			}
			organizationEmployeesMap.set(organization, employees);
			await insertEmployees(dataSource, employees);
		}
	}
	return organizationEmployeesMap;
};

const insertEmployees = async (dataSource: DataSource, employees: IEmployee[]): Promise<IEmployee[]> => {
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
export const getDefaultEmployees = async (dataSource: DataSource, tenant: ITenant): Promise<IEmployee[]> => {
	const organization = await getDefaultOrganization(dataSource, tenant);
	const employees = await dataSource.getRepository(Employee).find({
		where: {
			tenantId: tenant.id,
			organizationId: organization.id
		},
		relations: {
			tenant: true,
			organization: true
		}
	});
	return employees;
};
