import { Connection } from 'typeorm';
import { environment as env } from '@env-api/environment';
import { Income } from './income.entity';
import * as faker from 'faker';
import { CurrenciesEnum, Organization, Employee } from '@gauzy/models';
import { incomeData } from './income-seed-data/november-19';

export const createIncomes = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		employees: Employee[];
	}
): Promise<{ seededIncomes: Income[] }> => {
	const currencies = Object.values(CurrenciesEnum);

	const seededIncomes: Income[] = [];

	incomeData.map(async (seedIncome) => {
		const income = new Income();
		const foundEmployee = defaultData.employees.find(
			(emp) => emp.user.email === seedIncome.email
		);

		income.employee = foundEmployee;
		income.clientName = seedIncome.clientName;
		income.organization = defaultData.org;
		income.amount = seedIncome.amount;
		income.clientId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
		income.currency = seedIncome.currency;
		income.valueDate = new Date(seedIncome.valueDate);
		income.notes = seedIncome.notes;

		await insertIncome(connection, income);
		seededIncomes.push(income);
	});

	return { seededIncomes };
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
