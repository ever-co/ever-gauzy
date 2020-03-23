import { Connection } from 'typeorm';
import { Expense } from './expense.entity';
import * as faker from 'faker';
import {
	CurrenciesEnum,
	Organization,
	Employee,
	IExpenseCategory,
	OrganizationVendors
} from '@gauzy/models';
import * as fs from 'fs';
import * as csv from 'csv-parser';

export const createExpenses = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		employees: Employee[];
		categories: IExpenseCategory[];
		organizationVendors: OrganizationVendors[];
	},
	randomData: {
		orgs: Organization[];
		employees: Employee[];
		categories: IExpenseCategory[];
		organizationVendors: OrganizationVendors[];
	}
): Promise<{ defaultExpenses: Expense[]; randomExpenses: Expense[] }> => {
	const currencies = Object.values(CurrenciesEnum);
	const defaultExpenses = [];
	const filePath =
		'./apps/api/src/app/expense/expense-seed-data/expenses-data.csv';

	fs.createReadStream(filePath)
		.pipe(csv())
		.on('data', (data) => defaultExpenses.push(data))
		.on('end', () => {
			defaultExpenses.map(async (seedExpense) => {
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

				await insertExpense(connection, expense);
			});
		});

	const randomExpenses: Expense[] = [];

	const notesArray = [
		'Windows 10',
		'MultiSport Card',
		'Angular Masterclass',
		'Drive',
		'Rent for September'
	];

	for (let index = 0; index < 25; index++) {
		const expense = new Expense();

		const currentIndex = faker.random.number({ min: 0, max: index % 5 });

		expense.organization = randomData.orgs[index % 5];
		expense.employee = randomData.employees[currentIndex];
		expense.amount = faker.random.number({ min: 10, max: 999 });
		expense.vendor =
			randomData.organizationVendors[currentIndex] ||
			randomData.organizationVendors[0];
		expense.category =
			randomData.categories[currentIndex] || randomData.categories[0];
		expense.currency = currencies[(index % currencies.length) + 1 - 1];
		expense.valueDate = faker.date.recent(15);
		expense.notes = notesArray[currentIndex];

		await insertExpense(connection, expense);
		randomExpenses.push(expense);
	}

	return { defaultExpenses, randomExpenses };
};

const insertExpense = async (
	connection: Connection,
	expense: Expense
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Expense)
		.values(expense)
		.execute();
};
