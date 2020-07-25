import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '@gauzy/models';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import * as faker from 'faker';

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

  let Employees: EmployeeRecurringExpense[] = [];
  const currency= ['USD', 'BGN', 'ILS'];

  for (const tenant of tenants) {
    let tenantEmployees = tenantEmployeeMap.get(tenant);

    for (const tenantEmployee of tenantEmployees) {

      let employee = new EmployeeRecurringExpense();

      let startDate = faker.date.past();
      let endDate = faker.date.past();

      employee.employeeId = tenantEmployee.id;
      employee.startDay = startDate.getDate();
      employee.startMonth = startDate.getMonth() + 1;
      employee.startYear = startDate.getFullYear();
      employee.startDate = startDate;
      employee.endDay = endDate.getDate();
      employee.endMonth = endDate.getMonth();
      employee.endYear = endDate.getFullYear();
      employee.endDate = endDate;
      employee.categoryName = faker.name.jobTitle();
      employee.value = (Math.floor(Math.random() * 999) + 1);
      employee.currency = currency[Math.floor((Math.random()*2))];
      employee.parentRecurringExpenseId = null;
      employee.employee = tenantEmployee;
      Employees.push(employee);
    }
  }
  await insertRandomEmployeeRecurringExpense(connection, Employees);
  return Employees;
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
