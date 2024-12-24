import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { addDays } from 'date-fns';
import * as _ from 'underscore';
import { IEmployee, IOrganization, ITenant, ITimeOff as ITimeOffRequest, StatusTypesEnum } from '@gauzy/contracts';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';

const status = Object.values(StatusTypesEnum);

export const createDefaultEmployeeTimeOff = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[],
	noOfEmployeeTimeOffRequest: number
): Promise<ITimeOffRequest[]> => {
	let timeOffRequests: TimeOffRequest[] = [];

	const { id: tenantId } = tenant;
	const { id: organizationId } = organization;
	const policies = await dataSource.manager.find(TimeOffPolicy, {
		where: {
			tenantId,
			organizationId
		}
	});
	for (let i = 0; i < noOfEmployeeTimeOffRequest; i++) {
		for await (const policy of policies) {
			const request = new TimeOffRequest();
			request.policy = policy;
			request.organizationId = organizationId;
			request.tenantId = tenantId;
			request.employees = _.chain(employees)
				.shuffle()
				.take(faker.number.int({ min: 1, max: 3 }))
				.values()
				.value();
			request.description = 'Time off';
			request.isHoliday = faker.helpers.arrayElement([true, false]);
			request.isArchived = faker.helpers.arrayElement([true, false]);
			request.start = faker.date.future({ years: 0.5 });
			request.end = addDays(request.start, faker.number.int(7));
			request.requestDate = faker.date.recent();
			request.status = faker.helpers.arrayElement(status);
			request.documentUrl = '';

			const timeOffRequest = await dataSource.manager.save(request);
			timeOffRequests.push(timeOffRequest);
		}
	}
	return timeOffRequests;
};

export const createRandomEmployeeTimeOff = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfEmployeeTimeOffRequest: number
): Promise<TimeOffRequest[]> => {
	let requests: TimeOffRequest[] = [];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const { id: organizationId } = organization;
			const { id: tenantId } = tenant;

			const employees = organizationEmployeesMap.get(organization);
			const policies = await dataSource.manager.find(TimeOffPolicy, {
				where: {
					tenantId,
					organizationId
				}
			});

			for (let i = 0; i < noOfEmployeeTimeOffRequest; i++) {
				for await (const policy of policies) {
					const request = new TimeOffRequest();
					request.policy = policy;
					request.organizationId = organizationId;
					request.tenantId = tenantId;
					request.employees = _.chain(employees)
						.shuffle()
						.take(faker.number.int({ min: 1, max: 3 }))
						.values()
						.value();
					request.description = 'Time off';
					request.isHoliday = faker.helpers.arrayElement([true, false]);
					request.isArchived = faker.helpers.arrayElement([true, false]);
					request.start = faker.date.future({ years: 0.5 });
					request.end = addDays(request.start, faker.number.int(7));
					request.requestDate = faker.date.recent();
					request.status = faker.helpers.arrayElement(status);
					request.documentUrl = '';

					const timeOffRequest = await dataSource.manager.save(request);
					requests.push(timeOffRequest);
				}
			}
		}
	}
	return requests;
};
