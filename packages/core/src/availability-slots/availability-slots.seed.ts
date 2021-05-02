import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { AvailabilitySlot } from './availability-slots.entity';
import * as faker from 'faker';
import * as moment from 'moment';
import { AvailabilitySlotType } from '@gauzy/contracts';

export const createDefaultAvailabilitySlots = async (
	connection: Connection,
	tenants: Tenant[],
	organizations,
	employees,
	noOfAvailabilitySlotsPerOrganization: number
): Promise<AvailabilitySlot[]> => {
	let slots: AvailabilitySlot[] = [];
	for (const tenant of tenants) {
		slots = await dataOperation(
			connection,
			slots,
			noOfAvailabilitySlotsPerOrganization,
			employees,
			organizations,
			tenant
		);
	}
	return slots;
};

export const createRandomAvailabilitySlots = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	noOfAvailabilitySlotsPerOrganization: number
): Promise<AvailabilitySlot[]> => {
	let slots: AvailabilitySlot[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		const employees = tenantEmployeeMap.get(tenant);
		for (const org of organizations) {
			slots = await dataOperation(
				connection,
				slots,
				noOfAvailabilitySlotsPerOrganization,
				employees,
				org,
				tenant
			);
		}
	}
	return slots;
};

const dataOperation = async (
	connection: Connection,
	slots,
	noOfAvailabilitySlotsPerOrganization,
	employees,
	org,
	tenant
) => {
	for (let i = 0; i < noOfAvailabilitySlotsPerOrganization; i++) {
		const slot = new AvailabilitySlot();
		slot.allDay = faker.datatype.boolean();
		slot.employee = faker.random.arrayElement([
			faker.random.arrayElement(employees),
			null
		]);
		slot.organization = org;
		slot.tenant = tenant;
		slot.startTime = faker.date.between(
			new Date(),
			moment(new Date()).add(2, 'months').toDate()
		);
		slot.endTime = faker.date.between(
			slot.startTime,
			moment(slot.startTime).add(7, 'hours').toDate()
		);
		slot.type = faker.random.arrayElement(
			Object.values(AvailabilitySlotType)
		);
		slots.push(slot);
	}
	await connection.manager.save(slots);
	return slots;
};
