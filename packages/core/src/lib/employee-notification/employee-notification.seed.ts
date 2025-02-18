import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	IEmployee,
	IEmployeeNotification,
	IOrganization,
	ITenant
} from '@gauzy/contracts';
import { EmployeeNotification } from './employee-notification.entity';

/**
 * Generates default employee notifications for each employee within the provided tenants and organizations.
 *
 * @param dataSource - The DataSource instance to interact with the database.
 * @param tenant - The tenant object for which notifications are being created.
 * @param organizations - An array of organizations within the tenant.
 * @param organizationEmployees - An array of employees within the organization.
 * @returns A promise that resolves to an array of created employee notifications.
 */
export const createDefaultEmployeeNotifications = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	organizationEmployees: IEmployee[]
): Promise<IEmployeeNotification[]> => {
	// Initialize an array to hold the generated notifications
	const employeeNotifications: IEmployeeNotification[] = [];

	// Iterate over each organization
	for (const organization of organizations) {
		// Generate notifications for the current organization
		const notifications = generateEmployeeNotifications(tenant, organization, organizationEmployees);

		employeeNotifications.push(...notifications);
	}

	// Insert the generated notifications into the database
	return insertEmployeeNotification(dataSource, employeeNotifications);
};

/**
 * Generates random employee notifications for each employee within the provided tenants and organizations.
 *
 * @param dataSource - The DataSource instance to interact with the database.
 * @param tenants - An array of tenant objects.
 * @param tenantOrganizationsMap - A map associating each tenant with its corresponding organizations.
 * @param organizationEmployeesMap - A map associating each organization with its corresponding employees.
 * @returns A promise that resolves to an array of created employee notifications.
 */
export const createRandomEmployeeNotifications = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<IEmployeeNotification[]> => {
	// Initialize an array to hold the generated notifications
	const employeeNotifications: IEmployeeNotification[] = [];

	// Iterate over each tenant
	for (const tenant of tenants) {
		// Retrieve the organizations associated with the current tenant
		const organizations = tenantOrganizationsMap.get(tenant) || [];

		// Iterate over each organization
		for (const organization of organizations) {
			// Retrieve the employees associated with the current organization
			const organizationEmployees = organizationEmployeesMap.get(organization) || [];

			// Generate notifications for the current organization
			const notifications = generateEmployeeNotifications(tenant, organization, organizationEmployees);

			employeeNotifications.push(...notifications);
		}
	}

	// Insert the generated notifications into the database
	return await insertEmployeeNotification(dataSource, employeeNotifications);
};

/**
 * Generates employee notifications for a given tenant, organization, and employees.
 *
 * @param tenant - The tenant object for which notifications are being created.
 * @param organization - The organization within the tenant.
 * @param organizationEmployees - An array of employees within the organization.
 * @returns An array of generated employee notifications.
 */
const generateEmployeeNotifications = (
	tenant: ITenant,
	organization: IOrganization,
	organizationEmployees: IEmployee[]
): IEmployeeNotification[] => {
	const notifications: IEmployeeNotification[] = [];

	// Iterate over each employee
	for (const employee of organizationEmployees) {
		// Generate a random task title with dynamic naming
		const randomTaskTitle = `Task ${faker.number.int({ min: 1, max: 100 })}: ${faker.lorem.words(3)}`;

		// Assign a random sender from the same organization
		const potentialSenders = organizationEmployees.filter((e) => e.id !== employee.id);
		const sentByEmployee = potentialSenders.length > 0 ? faker.helpers.arrayElement(potentialSenders) : null;

		// Create and initialize the notification
		const notification = new EmployeeNotification({
			title: `You have been assigned to the task "${randomTaskTitle}"`,
			message: `Please ensure to complete the task "${randomTaskTitle}" by the end of the week.`,
			type: getRandomNotificationType(),
			entity: BaseEntityEnum.Employee,
			entityId: employee.id,
			receiverEmployeeId: employee.id,
			sentByEmployeeId: sentByEmployee ? sentByEmployee.id : undefined,
			organization,
			tenant
		});

		// Add the notification to the array
		notifications.push(notification);
	}

	return notifications;
};

// Function to get a random notification type
function getRandomNotificationType(): EmployeeNotificationTypeEnum {
	const values = Object.values(EmployeeNotificationTypeEnum);
	const randomIndex = Math.floor(Math.random() * values.length);
	return values[randomIndex];
}

/**
 * Inserts multiple EmployeeNotification records into the database efficiently.
 *
 * @param dataSource - The DataSource instance connected to the database.
 * @param notifications - An array of EmployeeNotification entities to be inserted.
 * @returns A promise that resolves once the insertion is complete.
 * @throws An error if the insertion fails.
 */
const insertEmployeeNotification = async (
	dataSource: DataSource,
	notifications: EmployeeNotification[]
): Promise<EmployeeNotification[]> => {
	if (!notifications.length) {
		console.warn('No notifications to insert. Please check the input data and try again');
		return [];
	}

	try {
		// Define the batch size to control the number of records inserted per query
		const batchSize = 100;

		// Get the repository for EmployeeNotification
		const notificationRepository = dataSource.getRepository(EmployeeNotification);

		// Insert the notifications in batches
		return await notificationRepository.save(notifications, { chunk: batchSize });
	} catch (error) {
		console.error('Error while inserting employee notifications:', error);
		return [];
	}
};
