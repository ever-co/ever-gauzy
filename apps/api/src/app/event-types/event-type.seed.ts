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

				eventTypes.push(event);
			}
		}
	}

	await connection.manager.save(eventTypes);
};
