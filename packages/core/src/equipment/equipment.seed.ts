import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { DEFAULT_RANDOM_EQUIPMENTS } from './default-equipments';
import { Equipment, Organization, Tag } from './../core/entities/internal';

export const createDefaultEquipments = async (
	connection: Connection,
	tenant: ITenant,
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
	equipment.currency = env.defaultCurrency;
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
	tenants: ITenant[],
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
			equipment.serialNumber = faker.datatype.uuid();
			equipment.manufacturedYear = faker.datatype.number({
				min: 2000,
				max: 2020
			});
			equipment.initialCost = faker.datatype.number({
				min: 10000,
				max: 50000
			});

			equipment.currency = env.defaultCurrency;
			equipment.maxSharePeriod = faker.datatype.number({ min: 1, max: 15 });
			equipment.tags = [faker.random.arrayElement(tags)];
			equipment.tenant = tenant;
			(equipment.organization = faker.random.arrayElement(organizations)),
				(equipment.autoApproveShare = faker.datatype.boolean());
			equipments.push(equipment);
		}
	}

	await insertEquipment(connection, equipments);
	return equipments;
};
