import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '@gauzy/models';
import { EmployeeSetting } from './employee-setting.entity';
import * as faker from 'faker';

export const createRandomEmployeeSetting = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>
): Promise<EmployeeSetting[]> => {

  if (!tenantEmployeeMap) {
    console.warn(
      'Warning: tenantCandidatesMap not found, Employee settings  will not be created'
    );
    return;
  }

  let Employees: EmployeeSetting[] = [];
  const currency = ['USD', 'BGN', 'ILS'];
  const setting = ['Normal', 'CUSTOME'];

  for (const tenant of tenants) {
    let tenantEmployees = tenantEmployeeMap.get(tenant);

    for (const tenantEmployee of tenantEmployees) {

      let employee = new EmployeeSetting();

      let startDate = faker.date.past();

      employee.employeeId = tenantEmployee.id;
      employee.month = startDate.getMonth() + 1;
      employee.year = startDate.getFullYear();
      employee.settingType = setting[ (Math.random()>0.5)? 1 : 0];
      employee.value = (Math.floor(Math.random() * 999) + 1);
      employee.currency = currency[Math.floor((Math.random() * 2))];
      employee.employee = tenantEmployee;
      Employees.push(employee);
    }
  }
  await insertRandomEmployeeSetting(connection, Employees);
  return Employees;
};

const insertRandomEmployeeSetting = async (
  connection: Connection,
  Employees: EmployeeSetting[]
) => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(EmployeeSetting)
    .values(Employees)
    .execute();
};
