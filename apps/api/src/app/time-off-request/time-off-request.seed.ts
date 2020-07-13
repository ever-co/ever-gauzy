import { Connection } from 'typeorm';
import * as faker from 'faker';
import { TimeOffRequest } from './time-off-request.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { addDays } from "date-fns";
import { StatusTypesEnum } from '@gauzy/models';

const status =  Object.values(StatusTypesEnum);

export const createRandomEmployeeTimeOff = async (
  connection: Connection,
  tenants: Tenant[],
  tenantOrganizationsMap: Map<Tenant, Organization[]>,
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  noOfEmployeeTimeOffRequest:number
): Promise<TimeOffRequest[]> => {
  let requests: TimeOffRequest[] = [];
  let policies = await connection.manager.find(TimeOffPolicy);
  for (const tenant of tenants) {
    let employees = tenantEmployeeMap.get(tenant);
    let organizations = tenantOrganizationsMap.get(tenant);
    for (const organization of organizations) {
        let policies = await connection.manager.find(TimeOffPolicy,{where:[{organizationId:organization.id}]});
        for (let i = 0; i < noOfEmployeeTimeOffRequest; i++) {
          let request = new TimeOffRequest();
          request.organizationId = organization.id;
          request.employees = [faker.random.arrayElement(employees)];
          request.description = "Time off";
          request.isHoliday =faker.random.arrayElement([true,false]);
          request.start = faker.date.future(0.5);
          request.end = addDays(request.start, faker.random.number(7));
          request.policy = faker.random.arrayElement(policies);
          request.requestDate = faker.date.recent();
          request.status = faker.random.arrayElement(status);
          requests.push(request);
        }
      }
  }
  return await connection.manager.save(requests);
};
