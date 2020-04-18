import { Connection } from 'typeorm';
import { Expense } from './expense.entity';
import * as faker from 'faker';
import {
	CurrenciesEnum,
	Organization,
	Employee,
	IExpenseCategory,
	IOrganizationVendor
} from '@gauzy/models';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { Tenant } from '../tenant/tenant.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';

export const createDefaultExpenses = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		employees: Employee[];
		categories: IExpenseCategory[];
		organizationVendors: IOrganizationVendor[];
	}
): Promise<Expense[]> => {
	const expensesFromFile = [];
	let defaultExpenses: Expense[] = [];
	const filePath =
		'./apps/api/src/app/expense/expense-seed-data/expenses-data.csv';

	fs.createReadStream(filePath)
		.pipe(csv())
		.on('data', (data) => expensesFromFile.push(data))
		.on('end', async () => {
			defaultExpenses = expensesFromFile.map((seedExpense) => {
				const expense = new Expense();
				const foundEmployee = defaultData.employees.find(
					(emp) => emp.user.email === seedExpense.email
				);

				const foundCategory = defaultData.categories.find(
					(category) => seedExpense.categoryName === category.name
				);

				const foundVendor = defaultData.organizationVendors.find(
					(vendor) => seedExpense.vendorName === vendor.name
				);

				expense.employee = foundEmployee;
				expense.organization = defaultData.org;
				expense.amount = Math.abs(seedExpense.amount);
				expense.vendor = foundVendor;
				expense.category = foundCategory;
				expense.currency = seedExpense.currency;
				expense.valueDate = new Date(seedExpense.valueDate);
				expense.notes = seedExpense.notes;

				return expense;
			});

			await insertExpense(connection, defaultExpenses);
		});

	return expensesFromFile;
};

export const createRandomExpenses = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	organizationVendorsMap: Map<Organization, OrganizationVendor[]>,
	categories: ExpenseCategory[]
): Promise<void> => {
	const currencies = Object.values(CurrenciesEnum);

	if (!categories) {
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
		const randomExpenses: Expense[] = [];

		const employees = tenantEmployeeMap.get(tenant);

		for (const employee of employees) {
			const organizationVendors = organizationVendorsMap.get(
				employee.organization
			);

			for (let index = 0; index < 5; index++) {
				const expense = new Expense();

				const currentIndex = faker.random.number({
					min: 0,
					max: index % 5
				});

				expense.organization = employee.organization;
				expense.employee = employee;
				expense.amount = faker.random.number({ min: 10, max: 999 });
				expense.vendor =
					organizationVendors[
						currentIndex % organizationVendors.length
					];
				expense.category = categories[currentIndex % categories.length];
				expense.currency =
					currencies[(index % currencies.length) + 1 - 1];
				expense.valueDate = faker.date.recent(15);
				expense.notes = notesArray[currentIndex];

				randomExpenses.push(expense);
			}
		}

		await insertExpense(connection, randomExpenses);
	}

	return;
};

const insertExpense = async (
	connection: Connection,
	expense: Expense[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Expense)
		.values(expense)
		.execute();
};
