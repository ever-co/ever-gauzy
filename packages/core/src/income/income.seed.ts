import { Connection } from 'typeorm';
import * as faker from 'faker';
import {
	IOrganization,
	IEmployee,
	ITenant,
	ContactType,
	OrganizationContactBudgetTypeEnum,
	IIncome
} from '@gauzy/contracts';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import * as path from 'path';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Income, OrganizationContact } from './../core/entities/internal';
import { getDummyImage } from './../core/utils';

export const createDefaultIncomes = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[],
	employees: IEmployee[]
): Promise<Income[]> => {
	let filePath = path.join(
		__dirname,
		...['income-seed-data', 'income-data.csv']
	);
	try {
		filePath = fs.existsSync(filePath)
			? filePath
			: `./income-seed-data/income-data.csv`;
	} catch (error) {
		console.error('Cannot find income data csv');
	}

	const incomeFromFile = [];
	let defaultIncomes = [];

	for await (const organization of organizations) {
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => incomeFromFile.push(data))
			.on('end', async () => {
				const incomes: IIncome[] = [];
				for await (const seedIncome of incomeFromFile) {
					const income = new Income();
					income.employee = employees.find((emp) => emp.user.email === seedIncome.email);
					income.organization = organization;
					income.tenant = tenant;
					income.amount = seedIncome.amount;
					income.currency = seedIncome.currency || env.defaultCurrency;
					income.valueDate = faker.date.between(
						new Date(),
						moment(new Date()).add(10, 'days').toDate()
					);
					income.notes = seedIncome.notes;
					
					const payload = {
						name: `Client ${seedIncome.clientName}`,
						tenant: tenant,
						organization: organization,
						contactType: ContactType.CLIENT,
						budgetType: OrganizationContactBudgetTypeEnum.HOURS
					}
					income.client = await connection.manager.findOne(OrganizationContact, { 
						where: {
							...payload
						} 
					});
					if (!income.client) {
						/**
						 * Create income related client
						 */
						income.client = await connection.manager.save(
							new OrganizationContact(payload)
						);
					}
					incomes.push(income);
				}
				await insertIncome(connection, incomes);
			});
	}

	return defaultIncomes;
};

export const createRandomIncomes = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>
): Promise<void> => {
	const notes = [
		'Great job!',
		'Well done!',
		'Nice!',
		'Done',
		'Great job!'
	];
	const randomIncomes: Income[] = []
	for (const tenant of tenants || []) {
		const organizationContacts = await connection.manager.find(OrganizationContact, { 
			where: { 
				tenant 
			} 
		});
		const employees = tenantEmployeeMap.get(tenant);
		for (const employee of employees || []) {
			for (let index = 0; index < 100; index++) {
				const income = new Income();
				const currentIndex = faker.datatype.number({
					min: 0,
					max: index % 5
				});
				income.organization = employee.organization;
				income.tenant = tenant;
				income.employee = employee;
				income.amount = faker.datatype.number({ min: 10, max: 9999 });
				if (organizationContacts.length) {
					income.client = faker.random.arrayElement(organizationContacts); 
				}
				income.currency = employee.organization.currency || env.defaultCurrency;
				income.valueDate = faker.date.between(
					new Date(),
					moment(new Date()).add(10, 'days').toDate()
				);
				income.notes = notes[currentIndex];
				randomIncomes.push(income);
			}
		}
	}
	await insertIncome(connection, randomIncomes);
	return;
};

const insertIncome = async (
	connection: Connection,
	incomes: Income[]
): Promise<void> => {
	try {
		await connection.manager.save(incomes);
	} catch (error) {
		console.log(error);
	}
};