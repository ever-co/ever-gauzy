import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IOrganization, IEmployee, IExpenseCategory, IOrganizationVendor, ITenant } from '@gauzy/contracts';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Expense } from './../core/entities/internal';

/**
 * Reads expense data from a CSV file asynchronously.
 *
 * @param filePath - The path to the CSV file.
 * @returns A promise that resolves to an array of expense seed data.
 */
const readExpenseDataFromCSV = (filePath: string): Promise<any[]> => {
	return new Promise((resolve, reject) => {
		const expenseData: any[] = [];
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => expenseData.push(data))
			.on('end', () => resolve(expenseData))
			.on('error', (error) => reject(error));
	});
};

/**
 * Builds default Expense entities for a given organization from seed data.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param tenant - The tenant object.
 * @param organization - The organization object.
 * @param employees - An array of employees.
 * @param seedData - The expense seed data from CSV.
 * @param categories - Expense categories.
 * @param organizationVendors - Organization vendors.
 * @returns An array of Expense entities.
 */
const buildDefaultExpensesForOrganization = async (
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[],
	seedData: any[],
	categories: IExpenseCategory[],
	organizationVendors: IOrganizationVendor[]
): Promise<Expense[]> => {
	return seedData.map((seedExpense) => {
		const foundEmployee = employees.find((emp) => emp.user.email === seedExpense.email);
		const foundCategory = categories.find((cat) => seedExpense.categoryName === cat.name);
		const foundVendor = organizationVendors.find((vendor) => seedExpense.vendorName === vendor.name);

		// Generate a random date between 3 months and 10 days ago
		const dateRange = faker.date.between({
			from: moment().subtract(3, 'months').toDate(),
			to: moment().add(10, 'days').toDate()
		});

		const expense = new Expense();
		expense.employee = foundEmployee;
		expense.organization = organization;
		expense.tenant = tenant;
		expense.amount = Math.abs(Number(seedExpense.amount));
		expense.vendor = foundVendor;
		expense.category = foundCategory;
		expense.currency = seedExpense.currency || env.defaultCurrency;
		expense.notes = seedExpense.notes;
		expense.valueDate = moment(dateRange).startOf('day').toDate();

		return expense;
	});
};

/**
 * Creates default expenses for the provided organizations.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param organizations - An array of organization objects.
 * @param tenant - The tenant object.
 * @param employees - An array of employee objects.
 * @param categories - An array of expense categories.
 * @param organizationVendors - An array of organization vendors.
 * @returns A promise that resolves to an array of created Expense entities.
 */
export const createDefaultExpenses = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	employees: IEmployee[],
	categories: IExpenseCategory[] | void,
	organizationVendors: IOrganizationVendor[] | void
): Promise<Expense[]> => {
	if (!categories) {
		console.warn('Warning: Categories not found, default expenses would not be created');
		return [];
	}
	if (!organizationVendors) {
		console.warn('Warning: Organization vendors not found, default expenses would not be created');
		return [];
	}

	const filePath = path.resolve(__dirname, 'expense-seed-data', 'expenses-data.csv');
	if (!fs.existsSync(filePath)) {
		console.error('Expense data CSV file not found.');
		return [];
	}

	// Read seed data from CSV
	const seedData = await readExpenseDataFromCSV(filePath);
	const allExpenses: Expense[] = [];

	// For each organization, build and insert expenses
	for (const organization of organizations) {
		const expenses = await buildDefaultExpensesForOrganization(
			tenant,
			organization,
			employees,
			seedData,
			categories,
			organizationVendors
		);

		await insertExpenses(dataSource, expenses);
		allExpenses.push(...expenses);
	}

	return allExpenses;
};

/**
 * Creates random expenses for employees across multiple tenants and organizations.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param tenants - An array of tenant objects.
 * @param tenantOrganizationsMap - A map of tenants to their organizations.
 * @param organizationEmployeesMap - A map of organizations to their employees.
 * @param organizationVendorsMap - A map of organizations to their vendors.
 * @param categoriesMap - A map of organizations to their expense categories.
 * @returns A promise that resolves when the random expenses have been created and inserted.
 */
export const createRandomExpenses = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	organizationVendorsMap: Map<IOrganization, IOrganizationVendor[]> | void,
	categoriesMap: Map<IOrganization, IExpenseCategory[]> | void
): Promise<void> => {
	if (!tenantOrganizationsMap) {
		console.warn('Warning: tenantOrganizationsMap not found, RandomExpenses will not be created');
		return;
	}
	if (!categoriesMap) {
		console.warn('Warning: categoriesMap not found, RandomExpenses will not be created');
		return;
	}
	if (!organizationVendorsMap) {
		console.warn('Warning: organizationVendorsMap not found, RandomExpenses will not be created');
		return;
	}

	const notes = ['Windows 10', 'MultiSport Card', 'Angular Masterclass', 'Drive', 'Rent for September'];

	// For each tenant, create 100 random expenses
	for (const tenant of tenants) {
		// Get organizations for the tenant
		const organizations = tenantOrganizationsMap.get(tenant) || [];

		// For each organization, create 100 random expenses
		for (const organization of organizations) {
			// Get employees, vendors, and categories for the organization
			const employees = organizationEmployeesMap.get(organization) || [];
			const organizationVendors = organizationVendorsMap.get(organization) || [];
			const categories = categoriesMap.get(organization) || [];
			const randomExpenses: Expense[] = [];

			for (const employee of employees) {
				// Create 100 random expenses per employee
				for (let index = 0; index < 100; index++) {
					// Generate a random number between 0 and 4
					const randomNumber = faker.number.int({ min: 0, max: 4 });

					// Generate a random date range between 3 months and 10 days from now
					const dateRange = faker.date.between({
						from: moment().subtract(3, 'months').calendar(),
						to: moment().add(10, 'days').calendar()
					});

					const expense = new Expense();
					expense.organization = organization;
					expense.tenant = tenant;
					expense.employee = employee;
					expense.amount = faker.number.int({ min: 10, max: 999 });
					expense.vendor = organizationVendors[randomNumber % organizationVendors.length];
					expense.category = categories[randomNumber % categories.length];
					expense.currency = employee.organization.currency || env.defaultCurrency;
					expense.notes = notes[randomNumber];
					expense.valueDate = moment(dateRange).startOf('day').toDate();
					randomExpenses.push(expense);
				}
			}

			// Insert the random expenses for the organization
			await insertExpenses(dataSource, randomExpenses);
		}
	}
};

/**
 * Inserts an array of Expense entities into the database in batches.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param expenses - An array of Expense entities to insert.
 * @param batchSize - (Optional) The number of records to insert per batch (default is 100).
 * @returns A promise that resolves to an array of inserted Expense entities.
 */
export const insertExpenses = async (
	dataSource: DataSource,
	expenses: Expense[],
	batchSize: number = 100
): Promise<Expense[]> => {
	if (!expenses || expenses.length === 0) {
		console.warn('No expenses provided to insert. Please check the input data and try again.');
		return [];
	}

	try {
		const repository = dataSource.getRepository(Expense);
		// Perform batch insert using the "chunk" option for efficiency
		return await repository.save(expenses, { chunk: batchSize });
	} catch (error) {
		console.error('Error while inserting expenses:', error);
		return [];
	}
};
