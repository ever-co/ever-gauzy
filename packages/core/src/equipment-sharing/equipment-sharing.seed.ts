import { Connection } from 'typeorm';
import { Equipment } from '../equipment/equipment.entity';
import { EquipmentSharing } from './equipment-sharing.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { addDays } from 'date-fns';
import { IEmployee } from '@gauzy/contracts';
import { Organization } from '../organization/organization.entity';

export const createDefaultEquipmentSharing = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
	defaultEmployees,
	noOfEquipmentSharingPerTenant: number
): Promise<EquipmentSharing[]> => {
	let equipmentSharings: EquipmentSharing[] = [];
	const equipments = await connection.manager.find(Equipment, {
		where: [{ tenant: tenant }]
	});
	equipmentSharings = await dataOperation(
		connection,
		equipmentSharings,
		noOfEquipmentSharingPerTenant,
		equipments,
		defaultEmployees,
		tenant,
		organization
	);

	return await connection.manager.save(equipmentSharings);
};

export const createRandomEquipmentSharing = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]>,
	noOfEquipmentSharingPerTenant: number
): Promise<EquipmentSharing[]> => {
	let equipmentSharings: EquipmentSharing[] = [];
	for (const tenant of tenants) {
		const equipments = await connection.manager.find(Equipment, {
			where: [{ tenant: tenant }]
		});
		const employees = tenantEmployeeMap.get(tenant);
		equipmentSharings = await dataOperation(
			connection,
			equipmentSharings,
			noOfEquipmentSharingPerTenant,
			equipments,
			employees,
			tenant,
			null
		);
	}
	return equipmentSharings;
};

const dataOperation = async (
	connection: Connection,
	equipmentSharings,
	noOfEquipmentSharingPerTenant,
	equipments,
	employees,
	tenant,
	organization
) => {
	for (let i = 0; i < noOfEquipmentSharingPerTenant; i++) {
		const sharing = new EquipmentSharing();
		sharing.equipment = faker.random.arrayElement(equipments);
		sharing.equipmentId = sharing.equipment.id;
		sharing.shareRequestDay = faker.date.recent(30);
		sharing.shareStartDay = faker.date.future(0.5);
		sharing.shareEndDay = addDays(
			sharing.shareStartDay,
			faker.datatype.number(15)
		);
		sharing.status = faker.datatype.number({ min: 1, max: 3 });
		// sharing.teams =[faker.random.arrayElement(teams)];
		sharing.employees = [faker.random.arrayElement(employees)];
		sharing.organization = organization;
		sharing.tenant = tenant;
		equipmentSharings.push(sharing);
	}
	await connection.manager.save(equipmentSharings);
	return equipmentSharings;
};
