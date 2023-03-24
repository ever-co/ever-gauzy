import { DataSource } from 'typeorm';
import {
	IEmployee,
	IOrganization,
	ITenant,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';

export const createRandomEmployeeRecurringExpense = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<EmployeeRecurringExpense[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Employee Recurring Expense  will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Employee Recurring Expense  will not be created'
		);
		return;
	}
	const employeeRecurringExpenses: EmployeeRecurringExpense[] = [];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			for (const [index, tenantEmployee] of tenantEmployees.entries()) {
				const employeeRecurringExpense = new EmployeeRecurringExpense();
				employeeRecurringExpense.employeeId = tenantEmployee.id;

				const startDate = faker.date.past();
				employeeRecurringExpense.startDay = startDate.getDate();
				employeeRecurringExpense.startMonth = startDate.getMonth() + 1;
				employeeRecurringExpense.startYear = startDate.getFullYear();
				employeeRecurringExpense.startDate = startDate;

				// TODO: fix endDate generation for some entities only, most should not have end date really
				if (index % 2 === 0) {
					// new changes
					const endDate = faker.date.between({
						from: new Date(startDate),
						to: moment(startDate).add(4, 'months').toDate()
					});
					employeeRecurringExpense.endDay = endDate.getDate();
					employeeRecurringExpense.endMonth = endDate.getMonth();
					employeeRecurringExpense.endYear = endDate.getFullYear();
					employeeRecurringExpense.endDate = endDate;
				}
				// TODO: seed with random Categories from that enum, but make sure that SALARY exists in most of employees anyway (except contractors)
				employeeRecurringExpense.categoryName =
					RecurringExpenseDefaultCategoriesEnum.SALARY;

				employeeRecurringExpense.value = faker.number.int(999); // new changes
				employeeRecurringExpense.currency = env.defaultCurrency; // new changes

				// TODO: some expenses should have a parent if they change "over time"
				employeeRecurringExpense.parentRecurringExpenseId = null;
				employeeRecurringExpense.employee = tenantEmployee;

				employeeRecurringExpense.tenant = tenant;
				employeeRecurringExpense.organization = organization;
				employeeRecurringExpenses.push(employeeRecurringExpense);
			}
		}
	}
	await insertRandomEmployeeRecurringExpense(dataSource, employeeRecurringExpenses);
	return employeeRecurringExpenses;
};

const insertRandomEmployeeRecurringExpense = async (
	dataSource: DataSource,
	Employees: EmployeeRecurringExpense[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(EmployeeRecurringExpense)
		.values(Employees)
		.execute();
};
