import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import {
	CurrenciesEnum,
	Employee,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/models';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import * as faker from 'faker';
import * as moment from 'moment';

export const createRandomEmployeeRecurringExpense = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>
): Promise<EmployeeRecurringExpense[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, Employee Recurring Expense  will not be created'
		);
		return;
	}

	const employees: EmployeeRecurringExpense[] = [];

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);

		for (const [index, tenantEmployee] of tenantEmployees.entries()) {
			const employee = new EmployeeRecurringExpense();
			employee.employeeId = tenantEmployee.id;

			const startDate = faker.date.past();
			employee.startDay = startDate.getDate();
			employee.startMonth = startDate.getMonth() + 1;
			employee.startYear = startDate.getFullYear();
			employee.startDate = startDate;

			// TODO: fix endDate generation for some entities only, most should not have end date really
			if (index % 2 === 0) {
				// new changes
				const endDate = faker.date.between(
					new Date(startDate),
					moment(startDate).add(4, 'months').toDate()
				);
				employee.endDay = endDate.getDate();
				employee.endMonth = endDate.getMonth();
				employee.endYear = endDate.getFullYear();
				employee.endDate = endDate;
			}
			// TODO: seed with random Categories from that enum, but make sure that SALARY exists in most of employees anyway (except contractors)
			employee.categoryName =
				RecurringExpenseDefaultCategoriesEnum.SALARY;

			employee.value = faker.random.number(999); // new changes
			employee.currency = CurrenciesEnum.USD; // new changes

			// TODO: some expenses should have a parent if they change "over time"
			employee.parentRecurringExpenseId = null;
			employee.employee = tenantEmployee;
			employee.tenant = tenant;
			employees.push(employee);
		}
	}

	await insertRandomEmployeeRecurringExpense(connection, employees);

	return employees;
};

const insertRandomEmployeeRecurringExpense = async (
	connection: Connection,
	Employees: EmployeeRecurringExpense[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmployeeRecurringExpense)
		.values(Employees)
		.execute();
};
