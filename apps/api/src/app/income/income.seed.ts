import { Connection } from 'typeorm';
import { environment as env } from '@env-api/environment';
import { Income } from './income.entity';
import * as faker from 'faker';
import { CurrenciesEnum, Organization, Employee } from '@gauzy/models';

export const createIncomes = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		employees: Employee[];
	},
	randomData: {
		orgs: Organization[];
		employees: Employee[];
	}
): Promise<{ defaultIncome: Income; randomIncomes: Income[] }> => {
	const defaultIncome = new Income();
	const currencies = Object.values(CurrenciesEnum);

	defaultIncome.employee = randomData.employees[0];
	defaultIncome.organization = defaultData.org;
	defaultIncome.amount = 20;
	defaultIncome.clientId = '15';
	defaultIncome.clientName = 'Alex Tasev';
	defaultIncome.currency = currencies[0];
	defaultIncome.valueDate = new Date();
	defaultIncome.notes = 'notes';

	await insertIncome(connection, defaultIncome);

	const randomIncomes: Income[] = [];

	for (let index = 1; index <= 4; index++) {
		const income = new Income();

		income.employee = randomData.employees[index];
		income.clientName = faker.random.words(2);
		income.organization = randomData.orgs[index];
		income.amount = faker.random.number();
		income.clientId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
		income.currency = currencies[(index % currencies.length) + 1 - 1];
		income.valueDate = faker.date.recent(15);
		income.notes = faker.random.words(6);

		await insertIncome(connection, income);
		randomIncomes.push(income);
	}

	return { defaultIncome, randomIncomes };
};

const insertIncome = async (
	connection: Connection,
	income: Income
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Income)
		.values(income)
		.execute();
};
