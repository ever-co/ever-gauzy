import { Connection } from 'typeorm';
import { environment as env } from '@env-api/environment';
import { Income } from './income.entity';
import * as faker from 'faker';
import { CurrenciesEnum, Organization, Employee } from '@gauzy/models';
import * as fs from 'fs';
import * as csv from 'csv-parser';

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
): Promise<{ defaultIncomes: Income[]; randomIncomes: Income[] }> => {
	const currencies = Object.values(CurrenciesEnum);
	const defaultIncomes = [];
	const filePath =
		'./apps/api/src/app/income/income-seed-data/income-data.csv';

	fs.createReadStream(filePath)
		.pipe(csv())
		.on('data', (data) => defaultIncomes.push(data))
		.on('end', () => {
			defaultIncomes.map(async (seedIncome) => {
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
			});
		});

	const randomIncomes: Income[] = [];

	const clientsArray = ['NA', 'UR', 'CA', 'ET', 'GA'];
	const notesArray = [
		'Great job!',
		'Well done!',
		'Nice!',
		'Done',
		'Great job!'
	];

	for (let index = 0; index < 25; index++) {
		const income = new Income();

		const currentIndex = faker.random.number({ min: 0, max: index % 5 });

		income.organization = randomData.orgs[index % 5];
		income.employee = randomData.employees[currentIndex];
		income.clientName = clientsArray[currentIndex];
		income.amount = faker.random.number({ min: 10, max: 9999 });
		income.clientId = faker.random
			.number({ min: 10, max: 9999 })
			.toString();
		income.currency = currencies[(index % currencies.length) + 1 - 1];
		income.valueDate = faker.date.recent(15);
		income.notes = notesArray[currentIndex];

		await insertIncome(connection, income);
	}

	return { defaultIncomes, randomIncomes };
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
