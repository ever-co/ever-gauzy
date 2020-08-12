import { Connection } from 'typeorm';
import * as faker from 'faker';
import { TimeOffRequest } from './time-off-request.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { addDays } from 'date-fns';
import { StatusTypesEnum } from '@gauzy/models';
import * as _ from 'underscore';

const status = Object.values(StatusTypesEnum);

export const createDefaultEmployeeTimeOff = async (
  connection: Connection,
  Organization,
  Employee,
  noOfEmployeeTimeOffRequest: number
): Promise<TimeOffRequest[]> => {
  let requests: TimeOffRequest[] = [];
   // for (const organization of organizations) {
  let policies = await connection.manager.find(TimeOffPolicy, {
    where: [{ organizationId: Organization.id }]
  });
  requests = await dataOperation(connection, requests, noOfEmployeeTimeOffRequest, Organization, Employee, policies);
  // }

  return requests;
};

export const createRandomEmployeeTimeOff = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	noOfEmployeeTimeOffRequest: number
): Promise<TimeOffRequest[]> => {
	let requests: TimeOffRequest[] = [];
	for (const tenant of tenants) {
		let employees = tenantEmployeeMap.get(tenant);
		let organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			let policies = await connection.manager.find(TimeOffPolicy, {
				where: [{ organizationId: organization.id }]
			});
      requests = await dataOperation(connection, requests, noOfEmployeeTimeOffRequest, organization, employees, policies);
    }
  }
  return requests;;
};


const dataOperation = async (connection: Connection, requests, noOfEmployeeTimeOffRequest, organization, employees, policies) => {
  for (let i = 0; i < noOfEmployeeTimeOffRequest; i++) {
    let request = new TimeOffRequest();
    request.organizationId = organization.id;
    request.employees = _.chain(employees)
      .shuffle()
      .take(faker.random.number({ min: 1, max: 3 }))
      .values()
      .value();
    request.description = 'Time off';
    request.isHoliday = faker.random.arrayElement([true, false]);
    request.start = faker.date.future(0.5);
    request.end = addDays(request.start, faker.random.number(7));
    request.policy = faker.random.arrayElement(policies);
    request.requestDate = faker.date.recent();
    request.status = faker.random.arrayElement(status);
    request.documentUrl = '';
    requests.push(request);
  }
  await connection.manager.save(requests);
  return requests;
};
