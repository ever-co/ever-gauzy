import { DataSource } from 'typeorm';
import { faker } from '@ever-co/faker';
import { addDays } from 'date-fns';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { EquipmentSharing } from './equipment-sharing.entity';
import { Equipment } from './../core/entities/internal';

export const createDefaultEquipmentSharing = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	defaultEmployees,
	noOfEquipmentSharingPerTenant: number
): Promise<EquipmentSharing[]> => {
	const { id: tenantId } = tenant;
	let equipmentSharings: EquipmentSharing[] = [];
	const equipments = await dataSource.manager.find(Equipment, {
		where: {
			tenantId: tenantId
		}
	});
	equipmentSharings = await dataOperation(
		dataSource,
		equipmentSharings,
		noOfEquipmentSharingPerTenant,
		equipments,
		defaultEmployees,
		tenant,
		organization
	);

	return await dataSource.manager.save(equipmentSharings);
};

export const createRandomEquipmentSharing = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	noOfEquipmentSharingPerTenant: number
): Promise<EquipmentSharing[]> => {
	let equipmentSharings: EquipmentSharing[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const equipments = await dataSource.manager.find(Equipment, {
			where: {
				tenantId: tenantId
			}
		});
		const employees = tenantEmployeeMap.get(tenant);
		equipmentSharings = await dataOperation(
			dataSource,
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
	dataSource: DataSource,
	equipmentSharings,
	noOfEquipmentSharingPerTenant,
	equipments,
	employees,
	tenant,
	organization
) => {
	for (let i = 0; i < noOfEquipmentSharingPerTenant; i++) {
		const sharing = new EquipmentSharing();
		sharing.name = faker.company.companyName();
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
	await dataSource.manager.save(equipmentSharings);
	return equipmentSharings;
};
