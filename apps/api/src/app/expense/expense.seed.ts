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
import * as moment from 'moment';

export const createDefaultExpenses = async (
	connection: Connection,
	defaultData: {
    organizations: Organization[];
		employees: Employee[];
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

	const expensesFromFile = [];
	let defaultExpenses: Expense[] = [];
	let filePath = './src/app/expense/expense-seed-data/expenses-data.csv';

	try {
		filePath = fs.existsSync(filePath)
			? filePath
			: `./apps/api/${filePath.slice(2)}`;
	} catch (error) {
		console.error('Cannot find income data csv');
	}

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
          expense.currency = seedExpense.currency;
          expense.valueDate = faker.date.between(new Date(), moment(new Date()).add(10, 'days').toDate());
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
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  organizationVendorsMap: Map<Organization, OrganizationVendor[]> | void,
  categoriesMap: Map<Organization, ExpenseCategory[]> | void
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

  const currencies = Object.values(CurrenciesEnum);

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
      const categories = categoriesMap.get(employee.organization);

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
          currencies[(index % currencies.length) + 1 - 1];
        expense.valueDate = faker.date.between(new Date(), moment(new Date()).add(10, 'days').toDate());
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
