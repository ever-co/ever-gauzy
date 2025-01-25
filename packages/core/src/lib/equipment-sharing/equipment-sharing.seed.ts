import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { addDays } from 'date-fns';
import { IEmployee, IEquipmentSharing, IOrganization, ITenant } from '@gauzy/contracts';
import { EquipmentSharing } from './equipment-sharing.entity';
import { Equipment } from './../core/entities/internal';

export const createDefaultEquipmentSharing = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	defaultEmployees: IEmployee[],
	noOfEquipmentSharingPerTenant: number
): Promise<IEquipmentSharing[]> => {
	const { id: tenantId } = tenant;
	const { id: organizationId } = organization;

	let equipmentSharings: EquipmentSharing[] = [];
	const equipments = await dataSource.manager.findBy(Equipment, {
		tenantId,
		organizationId
	});
	for (let i = 0; i < noOfEquipmentSharingPerTenant; i++) {
		for await (const equipment of equipments) {
			const sharing = new EquipmentSharing();
			sharing.name = faker.company.name();
			sharing.equipment = equipment;
			sharing.shareRequestDay = faker.date.recent({ days: 30 });
			sharing.shareStartDay = faker.date.future({ years: 0.5 });
			sharing.shareEndDay = addDays(sharing.shareStartDay, faker.number.int(15));
			sharing.status = faker.number.int({ min: 1, max: 3 });
			sharing.employees = [faker.helpers.arrayElement(defaultEmployees)];
			sharing.organization = organization;
			sharing.tenant = tenant;

			const equipmentSharing = await dataSource.manager.save(sharing);
			equipmentSharings.push(equipmentSharing);
		}
	}
	return equipmentSharings;
};

export const createRandomEquipmentSharing = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfEquipmentSharingPerTenant: number
): Promise<IEquipmentSharing[]> => {
	let equipmentSharings: EquipmentSharing[] = [];

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const { id: organizationId } = organization;
			const { id: tenantId } = tenant;

			const employees = organizationEmployeesMap.get(organization);
			const equipments = await dataSource.manager.findBy(Equipment, {
				tenantId,
				organizationId
			});
			for (let i = 0; i < noOfEquipmentSharingPerTenant; i++) {
				for await (const equipment of equipments) {
					const sharing = new EquipmentSharing();
					sharing.name = faker.company.name();
					sharing.equipment = equipment;
					sharing.shareRequestDay = faker.date.recent({ days: 30 });
					sharing.shareStartDay = faker.date.future({ years: 0.5 });
					sharing.shareEndDay = addDays(sharing.shareStartDay, faker.number.int(15));
					sharing.status = faker.number.int({ min: 1, max: 3 });
					sharing.employees = [faker.helpers.arrayElement(employees)];
					sharing.organization = organization;
					sharing.tenant = tenant;

					const equipmentSharing = await dataSource.manager.save(sharing);
					equipmentSharings.push(equipmentSharing);
				}
			}
		}
	}
	return equipmentSharings;
};
