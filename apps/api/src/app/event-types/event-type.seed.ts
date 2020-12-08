import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee, IOrganization } from '@gauzy/models';
import { EventType } from './event-type.entity';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';

export const createRandomEventType = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]>,
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
): Promise<EventType[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, deal  will not be created'
		);
		return;
	}
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, deal  will not be created'
		);
		return;
	}

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantEmployee of tenantEmployees) {
			const eventTypes: EventType[] = [];
			for (const tenantOrg of tenantOrgs) {
				const tags = await connection.manager.find(Tag, {
					where: [{ organization: tenantOrg }]
				});

				const event = new EventType();
				event.isActive = faker.random.boolean();
				event.description = faker.name.jobDescriptor();
				event.title = faker.name.jobTitle();
				event.durationUnit = 'minutes';
				event.duration = faker.random.number(50);
				event.organization = tenantOrg;
				event.employee = tenantEmployee;
				event.tags = tags;
				event.tenant = tenant;

				eventTypes.push(event);
			}
			await connection.manager.save(eventTypes);
		}
	}
};

export const createDefaultEventTypes = async (
	connection: Connection,
	tenant: Tenant,
	orgs: IOrganization[]
): Promise<EventType[]> => {
	const eventTypes: EventType[] = [];
	orgs.forEach((org) => {
		const eventType = new EventType();
		eventType.title = '15 Minutes Event';
		eventType.description = 'This is a default event type.';
		eventType.duration = 15;
		eventType.durationUnit = 'Minute(s)';
		eventType.isActive = true;
		eventType.organization = org;
		eventType.tenant = tenant;
		eventTypes.push(eventType);

		const eventTypeOne = new EventType();
		eventTypeOne.title = '30 Minutes Event';
		eventTypeOne.description = 'This is a default event type.';
		eventTypeOne.duration = 30;
		eventTypeOne.durationUnit = 'Minute(s)';
		eventTypeOne.isActive = true;
		eventTypeOne.organization = org;
		eventTypeOne.tenant = tenant;
		eventTypes.push(eventTypeOne);

		const eventTypeTwo = new EventType();
		eventTypeTwo.title = '60 Minutes Event';
		eventTypeTwo.description = 'This is a default event type.';
		eventTypeTwo.duration = 60;
		eventTypeTwo.durationUnit = 'Minute(s)';
		eventTypeTwo.isActive = true;
		eventTypeTwo.organization = org;
		eventTypeTwo.tenant = tenant;
		eventTypes.push(eventTypeTwo);
	});

	return await insertEventTypes(connection, eventTypes);
};

const insertEventTypes = async (
	connection: Connection,
	eventTypes: EventType[]
): Promise<EventType[]> => {
	return await connection.manager.save(eventTypes);
};
