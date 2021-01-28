import { Connection } from 'typeorm';
import { Expense } from './expense.entity';
import * as faker from 'faker';
import {
	IOrganization,
	IEmployee,
	IExpenseCategory,
	IOrganizationVendor
} from '@gauzy/contracts';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { Tenant } from '../tenant/tenant.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';

export const createDefaultExpenses = async (
	connection: Connection,
	defaultData: {
		organizations: IOrganization[];
		tenant: Tenant;
		employees: IEmployee[];
		categories: IExpenseCategory[] | void;
		organizationVendors: IOrganizationVendor[] | void;
	}
): Promise<Expense[]> => {
	if (!defaultData.categories) {
		console.warn(
			'Warning: Categories not found, default expenses would not be created'
		);
		return;
	}

	if (!defaultData.organizationVendors) {
		console.warn(
			'Warning: organizationVendors not found, default expenses would not be created'
		);
		return;
	}

	let filePath = path.join(
		__dirname,
		...['expense-seed-data', 'expenses-data.csv']
	);
	try {
		filePath = fs.existsSync(filePath)
			? filePath
			: `./expense-seed-data/expenses-data.csv`;
	} catch (error) {
		console.error('Cannot find expense data csv');
	}

	const expensesFromFile = [];
	let defaultExpenses: Expense[] = [];

	for (const organization of defaultData.organizations) {
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => expensesFromFile.push(data))
			.on('end', async () => {
				defaultExpenses = expensesFromFile.map((seedExpense) => {
					const expense = new Expense();
					const foundEmployee = defaultData.employees.find(
						(emp) => emp.user.email === seedExpense.email
					);

					const foundCategory = (defaultData.categories || []).find(
						(category) => seedExpense.categoryName === category.name
					);

					const foundVendor = (
						defaultData.organizationVendors || []
					).find((vendor) => seedExpense.vendorName === vendor.name);

					expense.employee = foundEmployee;
					expense.organization = organization;
					expense.tenant = organization.tenant;
					expense.amount = Math.abs(seedExpense.amount);
					expense.vendor = foundVendor;
					expense.category = foundCategory;
					expense.currency =
						seedExpense.currency || env.defaultCurrency;
					expense.valueDate = faker.date.between(
						new Date(),
						moment(new Date()).add(10, 'days').toDate()
					);
					expense.notes = seedExpense.notes;

					return expense;
				});

				await insertExpense(connection, defaultExpenses);
			});
	}

	return expensesFromFile;
};

export const createRandomExpenses = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]>,
	organizationVendorsMap: Map<IOrganization, OrganizationVendor[]> | void,
	categoriesMap: Map<IOrganization, ExpenseCategory[]> | void
): Promise<void> => {
	if (!categoriesMap) {
		console.warn(
			'Warning: categoriesMap not found, RandomExpenses will not be created'
		);
		return;
	}

	if (!organizationVendorsMap) {
		console.warn(
			'Warning: organizationVendorsMap not found, RandomExpenses will not be created'
		);
		return;
	}

	const notesArray = [
		'Windows 10',
		'MultiSport Card',
		'Angular Masterclass',
		'Drive',
		'Rent for September'
	];

	for (const tenant of tenants) {
		const employees = tenantEmployeeMap.get(tenant);
		for (const employee of employees) {
			const organizationVendors = organizationVendorsMap.get(
				employee.organization
			);
			const categories = categoriesMap.get(employee.organization);
			const randomExpenses: Expense[] = [];

			for (let index = 0; index < 100; index++) {
				const expense = new Expense();

				const currentIndex = faker.random.number({
					min: 0,
					max: index % 5
				});

				expense.organization = employee.organization;
				expense.tenant = tenant;
				expense.employee = employee;
				expense.amount = faker.random.number({ min: 10, max: 999 });
				expense.vendor =
					organizationVendors[
						currentIndex % organizationVendors.length
					];
				expense.category = categories[currentIndex % categories.length];
				expense.currency =
					employee.organization.currency || env.defaultCurrency;
				expense.valueDate = faker.date.between(
					new Date(),
					moment(new Date()).add(10, 'days').toDate()
				);
				expense.notes = notesArray[currentIndex];

				randomExpenses.push(expense);
			}
			await insertExpense(connection, randomExpenses);
		}
	}
	return;
};

const insertExpense = async (
	connection: Connection,
	expenses: Expense[]
): Promise<void> => {
	await connection.manager.save(expenses);
};
