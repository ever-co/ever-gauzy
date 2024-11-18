import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import moment from 'moment';
import { AvailabilitySlotType, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { AvailabilitySlot } from './availability-slots.entity';

export const createDefaultAvailabilitySlots = async (
	dataSource: DataSource,
	tenants: ITenant[],
	organization: IOrganization,
	employees,
	noOfAvailabilitySlotsPerOrganization: number
): Promise<AvailabilitySlot[]> => {
	let slots: AvailabilitySlot[] = [];
	for (const tenant of tenants) {
		slots = await dataOperation(
			dataSource,
			slots,
			noOfAvailabilitySlotsPerOrganization,
			employees,
			organization,
			tenant
		);
	}
	return slots;
};

export const createRandomAvailabilitySlots = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfAvailabilitySlotsPerOrganization: number
): Promise<AvailabilitySlot[]> => {
	let slots: AvailabilitySlot[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization);
			slots = await dataOperation(
				dataSource,
				slots,
				noOfAvailabilitySlotsPerOrganization,
				employees,
				organization,
				tenant
			);
		}
	}
	return slots;
};

const dataOperation = async (
	dataSource: DataSource,
	slots,
	noOfAvailabilitySlotsPerOrganization,
	employees,
	organization,
	tenant
) => {
	for (let i = 0; i < noOfAvailabilitySlotsPerOrganization; i++) {
		const slot = new AvailabilitySlot();
		slot.allDay = faker.datatype.boolean();
		slot.employee = faker.helpers.arrayElement([
			faker.helpers.arrayElement(employees),
			null
		]);
		slot.organization = organization;
		slot.tenant = tenant;
		slot.startTime = faker.date.between({
			from: new Date(),
			to: moment(new Date()).add(2, 'months').toDate()
		});
		slot.endTime = faker.date.between({
			from: slot.startTime,
			to: moment(slot.startTime).add(7, 'hours').toDate()
		});
		slot.type = faker.helpers.arrayElement(
			Object.values(AvailabilitySlotType)
		);
		slots.push(slot);
	}
	await dataSource.manager.save(slots);
	return slots;
};
