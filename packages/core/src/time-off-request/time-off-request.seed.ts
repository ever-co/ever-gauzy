import { DataSource } from 'typeorm';
import { faker } from '@ever-co/faker';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { addDays } from 'date-fns';
import { IEmployee, IOrganization, ITenant, StatusTypesEnum } from '@gauzy/contracts';
import * as _ from 'underscore';

const status = Object.values(StatusTypesEnum);

export const createDefaultEmployeeTimeOff = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[],
	noOfEmployeeTimeOffRequest: number
): Promise<TimeOffRequest[]> => {
	let requests: TimeOffRequest[] = [];
	const policies = await dataSource.manager.find(TimeOffPolicy, {
		where: [{ organizationId: organization.id }]
	});
	requests = await dataOperation(
		dataSource,
		tenant,
		requests,
		noOfEmployeeTimeOffRequest,
		organization,
		employees,
		policies
	);
	return requests;
};

export const createRandomEmployeeTimeOff = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfEmployeeTimeOffRequest: number
): Promise<TimeOffRequest[]> => {
	let requests: TimeOffRequest[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization);
			const policies = await dataSource.manager.find(TimeOffPolicy, {
				where: [{ organizationId: organization.id }]
			});
			requests = await dataOperation(
				dataSource,
				tenant,
				requests,
				noOfEmployeeTimeOffRequest,
				organization,
				employees,
				policies
			);
		}
	}
	return requests;
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	requests,
	noOfEmployeeTimeOffRequest,
	organization,
	employees,
	policies
) => {
	for (let i = 0; i < noOfEmployeeTimeOffRequest; i++) {
		const request = new TimeOffRequest();
		request.organizationId = organization.id;
		request.tenant = tenant;
		request.employees = _.chain(employees)
			.shuffle()
			.take(faker.datatype.number({ min: 1, max: 3 }))
			.values()
			.value();
		request.description = 'Time off';
		request.isHoliday = faker.random.arrayElement([true, false]);
		request.isArchived = faker.random.arrayElement([true, false]);
		request.start = faker.date.future(0.5);
		request.end = addDays(request.start, faker.datatype.number(7));
		request.policy = faker.random.arrayElement(policies);
		request.requestDate = faker.date.recent();
		request.status = faker.random.arrayElement(status);
		request.documentUrl = '';
		requests.push(request);
	}
	await dataSource.manager.save(requests);
	return requests;
};
