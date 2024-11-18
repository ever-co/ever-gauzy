import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
	IOrganization,
	IEmployee,
	IExpenseCategory,
	IOrganizationVendor,
	ITenant
} from '@gauzy/contracts';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Expense } from './../core/entities/internal';

export const createDefaultExpenses = async (
	dataSource: DataSource,
	organizations: IOrganization[],
	tenant: ITenant,
	employees: IEmployee[],
	categories: IExpenseCategory[] | void,
	organizationVendors: IOrganizationVendor[] | void,
): Promise<Expense[]> => {
	if (!categories) {
		console.warn(
			'Warning: Categories not found, default expenses would not be created'
		);
		return;
	}

	if (!organizationVendors) {
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

	for (const organization of organizations) {
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => expensesFromFile.push(data))
			.on('end', async () => {
				defaultExpenses = expensesFromFile.map((seedExpense) => {
					const expense = new Expense();
					const foundEmployee = employees.find(
						(emp) => emp.user.email === seedExpense.email
					);
					const foundCategory = (categories || []).find(
						(category) => seedExpense.categoryName === category.name
					);
					const foundVendor = (organizationVendors || []).find((vendor) => seedExpense.vendorName === vendor.name);
					expense.employee = foundEmployee;
					expense.organization = organization;
					expense.tenant = tenant;
					expense.amount = Math.abs(seedExpense.amount);
					expense.vendor = foundVendor;
					expense.category = foundCategory;
					expense.currency = seedExpense.currency || env.defaultCurrency;
					expense.notes = seedExpense.notes;
					expense.valueDate = moment(
						faker.date.between({
							from: moment().subtract(3, 'months').calendar(),
							to: moment().add(10, 'days').calendar()
						})
					)
						.startOf('day')
						.toDate();
					return expense;
				});
				await insertExpense(dataSource, defaultExpenses);
			});
	}
	return expensesFromFile;
};

export const createRandomExpenses = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	organizationVendorsMap: Map<IOrganization, IOrganizationVendor[]> | void,
	categoriesMap: Map<IOrganization, IExpenseCategory[]> | void
): Promise<void> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, RandomExpenses will not be created'
		);
		return;
	}
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
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization);
			for (const employee of employees) {
				const organizationVendors = organizationVendorsMap.get(employee.organization);
				const categories = categoriesMap.get(employee.organization);
				const randomExpenses: Expense[] = [];
				for (let index = 0; index < 100; index++) {
					const expense = new Expense();
					const currentIndex = faker.number.int({
						min: 0,
						max: index % 5
					});
					expense.organization = employee.organization;
					expense.tenant = tenant;
					expense.employee = employee;
					expense.amount = faker.number.int({ min: 10, max: 999 });
					expense.vendor =
						organizationVendors[
						currentIndex % organizationVendors.length
						];
					expense.category = categories[currentIndex % categories.length];
					expense.currency = employee.organization.currency || env.defaultCurrency;
					expense.notes = notesArray[currentIndex];
					expense.valueDate = moment(
						faker.date.between({
							from: moment().subtract(3, 'months').calendar(),
							to: moment().add(10, 'days').calendar()
						})
					)
						.startOf('day')
						.toDate();
					randomExpenses.push(expense);
				}
				await insertExpense(dataSource, randomExpenses);
			}
		}
	}
	return;
};

const insertExpense = async (
	dataSource: DataSource,
	expenses: Expense[]
): Promise<void> => {
	await dataSource.manager.save(expenses);
};
