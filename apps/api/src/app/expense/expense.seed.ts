import { Connection } from 'typeorm';
import { Expense } from './expense.entity';
import * as faker from 'faker';
import { CurrenciesEnum, Organization, Employee } from '@gauzy/models';

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
): Promise<{ defaultExpense: Expense; randomExpenses: Expense[] }> => {
	const defaultExpense = new Expense();
	const currencies = Object.values(CurrenciesEnum);

	defaultExpense.employee = randomData.employees[0];
	defaultExpense.organization = defaultData.org;
	defaultExpense.amount = 20;
	defaultExpense.vendorName = 'Ever';
	defaultExpense.vendorId = '15';
	defaultExpense.categoryName = 'Software';
	defaultExpense.categoryId = '15';
	defaultExpense.currency = currencies[0];
	defaultExpense.valueDate = new Date();
	defaultExpense.notes = 'Some notes';

	await insertExpense(connection, defaultExpense);

	const randomExpenses: Expense[] = [];

	for (let index = 1; index <= 4; index++) {
		const expense = new Expense();

		expense.employee = randomData.employees[index];
		expense.organization = randomData.orgs[index];
		expense.amount = faker.random.number();
		expense.vendorName = faker.random.words(1);
		expense.vendorId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
		expense.categoryName = faker.random.words(1);
		expense.categoryId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
		expense.currency = currencies[(index % currencies.length) + 1 - 1];
		expense.valueDate = faker.date.recent(15);
		expense.notes = faker.random.words(6);

		await insertExpense(connection, expense);
		randomExpenses.push(expense);
	}

	return { defaultExpense, randomExpenses };
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
