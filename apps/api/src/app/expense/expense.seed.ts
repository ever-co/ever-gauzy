import { Connection } from 'typeorm';
import { Expense } from './expense.entity';
import * as faker from 'faker';
import { CurrenciesEnum, Organization, Employee } from '@gauzy/models';
import * as fs from 'fs';
import * as csv from 'csv-parser';

export const createExpenses = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		employees: Employee[];
	},
	randomData: {
		orgs: Organization[];
		employees: Employee[];
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
				// const foundEmployee = defaultData.employees.find(
				// 	(emp) => emp.user.email === seedExpense.email
				// );

				// expense.employee = foundEmployee;
				expense.organization = defaultData.org;
				expense.amount = Math.abs(seedExpense.amount);
				expense.vendorName = seedExpense.vendorName;
				expense.vendorId = seedExpense.vendorId;
				expense.categoryName = seedExpense.categoryName;
				expense.categoryId = faker.random
					.number({ min: 10, max: 9999 })
					.toString();
				expense.currency = seedExpense.currency;
				expense.valueDate = new Date(seedExpense.valueDate);
				expense.notes = seedExpense.notes;

				await insertExpense(connection, expense);
			});
		});

	const randomExpenses: Expense[] = [];

	const vendorsArray = [
		'Microsoft',
		'Benefit Systems',
		'Udemy',
		'Google',
		'CoShare'
	];
	const categoryArray = [
		'Software',
		'Employees Benefits',
		'Courses',
		'Subscriptions',
		'Rent'
	];
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
		expense.vendorName = vendorsArray[currentIndex];
		expense.vendorId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
		expense.categoryName = categoryArray[currentIndex];
		expense.categoryId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
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
