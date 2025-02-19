import { DataSource } from 'typeorm';
import { IEmployee, IEmployeeNotificationSetting, IOrganization, ITenant } from '@gauzy/contracts';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';

/**
 * Generates random notification settings.
 *
 * @returns An object containing random boolean values for each notification setting.
 */
const generateRandomNotificationSettings = (): { [key: string]: any } => {
	const getRandomBoolean = () => Math.random() < 0.5;

	return {
		payment: getRandomBoolean(),
		assignment: getRandomBoolean(),
		invitation: getRandomBoolean(),
		mention: getRandomBoolean(),
		comment: getRandomBoolean(),
		message: getRandomBoolean(),
		preferences: {} // Assuming preferences is an object; adjust as needed
	};
};

/**
 * Creates default notification settings for each employee in the provided list.
 *
 * @param dataSource - The DataSource instance representing the database connection.
 * @param tenant - The tenant associated with the notification settings.
 * @param organization - The organization associated with the notification settings.
 * @param employees - An array of Employee entities for whom the notification settings are to be created.
 * @returns A promise that resolves to an array of created EmployeeNotificationSetting entities.
 */
export const createDefaultEmployeeNotificationSettings = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[]
): Promise<EmployeeNotificationSetting[]> => {
	// Generate random notification settings
	const defaultSettings = generateRandomNotificationSettings();

	// Map employees to notification settings
	const notificationSettings = employees.map((employee: IEmployee) => ({
		employee: employee,
		tenant: tenant,
		organization: organization,
		...defaultSettings
	}));

	// Insert the generated notification settings into the database
	return await insertEmployeeNotificationSettings(dataSource, notificationSettings);
};

/**
 * Creates random notification settings for each employee across multiple tenants and organizations.
 *
 * @param dataSource - The DataSource instance representing the database connection.
 * @param tenants - An array of Tenant entities.
 * @param tenantOrganizationsMap - A map associating each tenant with its organizations.
 * @param organizationEmployeesMap - A map associating each organization with its employees.
 * @returns A promise that resolves to an array of created EmployeeNotificationSetting entities.
 */
export const createRandomEmployeeNotificationSettings = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<IEmployeeNotificationSetting[]> => {
	// Initialize an array to hold the generated notifications
	const notificationSettings: IEmployeeNotificationSetting[] = [];

	// Iterate over each tenant
	for (const tenant of tenants) {
		// Retrieve the organizations associated with the current tenant
		const organizations = tenantOrganizationsMap.get(tenant) || [];

		// Iterate over each organization
		for (const organization of organizations) {
			// Retrieve the employees associated with the current organization
			const organizationEmployees = organizationEmployeesMap.get(organization) || [];

			// Generate random notification settings
			const defaultSettings = generateRandomNotificationSettings();

			// Map employees to notification settings
			const settings = organizationEmployees.map((employee: IEmployee) => ({
				employee: employee,
				tenant: tenant,
				organization: organization,
				...defaultSettings
			}));

			notificationSettings.push(...settings);
		}
	}

	// Insert the generated notification settings into the database
	return await insertEmployeeNotificationSettings(dataSource, notificationSettings);
};

/**
 * Inserts multiple EmployeeNotificationSetting entities into the database.
 *
 * @param dataSource - The DataSource instance representing the database connection.
 * @param settings - An array of EmployeeNotificationSetting entities to be inserted.
 * @returns A promise that resolves to an array of inserted EmployeeNotificationSetting entities.
 */
const insertEmployeeNotificationSettings = async (
	dataSource: DataSource,
	settings: EmployeeNotificationSetting[]
): Promise<EmployeeNotificationSetting[]> => {
	if (!settings || settings.length === 0) {
		console.warn('No employee notification settings to insert. Please check the input data and try again.');
		return [];
	}

	try {
		// Define the batch size to control the number of records inserted per query
		const batchSize = 100;

		// Get the repository for EmployeeNotificationSetting
		const repository = dataSource.getRepository(EmployeeNotificationSetting);

		// Insert the notifications in batches
		return await repository.save(settings, { chunk: batchSize });
	} catch (error) {
		console.error('Error while inserting employee notification settings:', error);
		throw error; // Rethrow the error after logging it
	}
};
