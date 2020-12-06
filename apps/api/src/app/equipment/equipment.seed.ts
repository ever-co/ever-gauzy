import { Connection } from 'typeorm';
import { Equipment } from './equipment.entity';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { CurrenciesEnum, IOrganization } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_RANDOM_EQUIPMENTS } from './default-equipments';

export const createDefaultEquipments = async (
	connection: Connection,
	tenant: Tenant,
	organization: IOrganization
): Promise<Equipment[]> => {
	const tags = await connection
		.getRepository(Tag)
		.createQueryBuilder()
		.getMany();
	const equipments: Equipment[] = [];

	const equipment = new Equipment();
	equipment.name = 'Fiat Freemont';
	equipment.type = 'Car';
	equipment.serialNumber = 'CB0950AT';
	equipment.manufacturedYear = 2015;
	equipment.initialCost = 40000;
	equipment.currency = CurrenciesEnum.BGN;
	equipment.maxSharePeriod = 7;
	equipment.tags = [faker.random.arrayElement(tags)];
	equipment.tenant = tenant;
	equipment.organization = organization;
	equipment.autoApproveShare = true;
	equipments.push(equipment);

	await insertEquipment(connection, equipments);
	return equipments;
};

const insertEquipment = async (
	connection: Connection,
	equipment: Equipment[]
): Promise<void> => {
	await connection.manager.save(equipment);
};

export const createRandomEquipments = async (
	connection: Connection,
	tenants: Tenant[],
	noOfEquipmentsPerTenant: number
): Promise<Equipment[]> => {
	const equipments: Equipment[] = [];
	const tags = await connection
		.getRepository(Tag)
		.createQueryBuilder()
		.getMany();

	for await (const tenant of tenants || []) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});

		for (let i = 0; i < noOfEquipmentsPerTenant; i++) {
			const equipment = new Equipment();
			const randomElement = faker.random.arrayElement(
				DEFAULT_RANDOM_EQUIPMENTS
			);
			equipment.type = randomElement.key;
			equipment.name = faker.random.arrayElement(randomElement.value);
			equipment.serialNumber = faker.random.uuid();
			equipment.manufacturedYear = faker.random.number({
				min: 2000,
				max: 2020
			});
			equipment.initialCost = faker.random.number({
				min: 10000,
				max: 50000
			});
			equipment.currency = faker.random.arrayElement(
				Object.values(CurrenciesEnum)
			);
			equipment.maxSharePeriod = faker.random.number({ min: 1, max: 15 });
			equipment.tags = [faker.random.arrayElement(tags)];
			equipment.tenant = tenant;
			(equipment.organization = faker.random.arrayElement(organizations)),
				(equipment.autoApproveShare = faker.random.boolean());
			equipments.push(equipment);
		}
	}

	await insertEquipment(connection, equipments);
	return equipments;
};
