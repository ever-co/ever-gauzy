import { DataSource } from 'typeorm';
import { CurrenciesEnum, IEmployee, IOrganization, ITenant, IUser, PayPeriodEnum } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { environment as env } from '@gauzy/config';
import { Employee } from './../core/entities/internal';
import { getDefaultOrganization } from './../organization/organization.seed';

/**
 * Creates default employees for the given organization.
 *
 * @param dataSource - The data source to interact with the database.
 * @param tenant - The tenant to which the employees belong.
 * @param organization - The organization for the employees.
 * @param users - The users to be converted into employees.
 * @param defaultEmployees - The default employee configurations.
 * @returns The created employees.
 */
export const createDefaultEmployees = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	users: IUser[],
	defaultEmployees: any
): Promise<IEmployee[]> => {
	// Pre compute the organization's currency or use the default currency
	const currency = organization.currency || env.defaultCurrency;

	// Use the default employee configurations to generate employees
	const employees = users.map((user) => {
		const defaultEmployee = defaultEmployees.find(({ email }) => email === user.email);

		// Generate bill rate and minimum billing rate once to avoid repeated calculations
		const billRateValue = faker.number.int({ min: 15, max: 40 });
		const minimumBillingRate = faker.number.int({ min: 5, max: billRateValue - 1 });

		return new Employee({
			organization,
			tenant,
			user,
			employeeLevel: defaultEmployee?.employeeLevel,
			startedWorkOn: parseDate(defaultEmployee?.startedWorkOn),
			endWork: parseDate(defaultEmployee?.endWork),
			payPeriod: faker.helpers.arrayElement(Object.values(PayPeriodEnum)),
			billRateValue,
			billRateCurrency: currency as CurrenciesEnum,
			minimumBillingRate,
			reWeeklyLimit: faker.number.int({ min: 10, max: 40 })
		});
	});

	await insertEmployees(dataSource, employees);
	return employees;
};

/**
 * Creates random employees for each tenant and organization.
 *
 * This function iterates over the provided tenants and their associated organizations,
 * generating random employees for each organization based on the users associated with
 * that organization. The employees are then inserted into the database and returned in
 * a map, associating organizations with their respective employees.
 *
 * @param dataSource - The data source for interacting with the database.
 * @param tenants - A list of tenant entities for which employees will be created.
 * @param tenantOrganizationsMap - A map associating each tenant with their respective organizations.
 * @param organizationUsersMap - A map associating each organization with its users.
 * @returns A promise that resolves to a map associating organizations with their respective employees.
 */
export const createRandomEmployees = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationUsersMap: Map<IOrganization, IUser[]>
): Promise<Map<IOrganization, IEmployee[]>> => {
	// Initialize the map to store organizations and their respective employees
	const organizationEmployeesMap = new Map<IOrganization, IEmployee[]>();

	// Iterate through each tenant
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant) || [];

		// Iterate through each organization in the tenant
		for (const organization of organizations) {
			const users = organizationUsersMap.get(organization) || [];

			// Map each user to a new random employee entity
			const employees = users.map((user) => {
				const employee = new Employee({
					organization,
					tenant,
					user,
					isActive: true,
					startedWorkOn: faker.date.past(),
					payPeriod: faker.helpers.arrayElement(Object.values(PayPeriodEnum)),
					billRateValue: faker.number.int({ min: 15, max: 40 }),
					billRateCurrency: (organization.currency || env.defaultCurrency) as CurrenciesEnum,
					reWeeklyLimit: faker.number.int({ min: 10, max: 40 }),
					endWork: null
				});
				return employee;
			});

			// Add employees to the map and save them to the database
			organizationEmployeesMap.set(organization, employees);
			await insertEmployees(dataSource, employees);
		}
	}

	return organizationEmployeesMap;
};

/**
 * Inserts the employees into the database.
 *
 * @param dataSource - The data source for database interactions.
 * @param employees - The list of employees to be inserted.
 * @returns A promise of inserted employees.
 */
const insertEmployees = (dataSource: DataSource, employees: IEmployee[]): Promise<IEmployee[]> => {
	return dataSource.manager.save(employees);
};

/**
 * Parses a date string into a Date object.
 *
 * @param dateString - The string to be parsed.
 * @returns The parsed Date object, or null if the string is not provided.
 */
const parseDate = (dateString?: string): Date | null => {
	return dateString ? new Date(dateString) : null;
};

/**
 * Fetches default employees for the given tenant.
 */
export const getDefaultEmployees = async (
	dataSource: DataSource,
	tenant: ITenant
): Promise<IEmployee[]> => {
	// Get the default organization for the given tenant
	const organization = await getDefaultOrganization(dataSource, tenant);

	// Fetch the employees for the given organization
	return dataSource.getRepository(Employee).find({
		where: { tenantId: tenant.id, organizationId: organization.id },
		relations: { tenant: true, organization: true }
	});
};
