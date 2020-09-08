import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee, Organization } from '@gauzy/models';
import { EventType } from './event-type.entity';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';

export const createRandomEventType = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	tenantOrganizationsMap: Map<Tenant, Organization[]>
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

	const eventTypes: EventType[] = [];

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		const tenantOrgs = tenantOrganizationsMap.get(tenant);

		for (const tenantEmployee of tenantEmployees) {
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
		}
	}

	await connection.manager.save(eventTypes);
};

export const createDefaultEventTypes = async (
	connection: Connection,
	tenant: Tenant,
	orgs: Organization[]
): Promise<void> => {
	const eventTypes: EventType[] = [];
	console.log('tenant', tenant);

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
		eventTypes.push(eventTypeOne);

		const eventTypeTwo = new EventType();
		eventTypeTwo.title = '60 Minutes Event';
		eventTypeTwo.description = 'This is a default event type.';
		eventTypeTwo.duration = 60;
		eventTypeTwo.durationUnit = 'Minute(s)';
		eventTypeTwo.isActive = true;
		eventTypeTwo.organization = org;
		eventTypes.push(eventTypeTwo);
	});

	await insertEventTypes(connection, eventTypes);
};

const insertEventTypes = async (
	connection: Connection,
	eventTypes: EventType[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EventType)
		.values(eventTypes)
		.execute();
};
