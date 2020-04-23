import { Connection } from 'typeorm';
import { Tenant } from './tenant.entity';
import * as faker from 'faker';

export const createDefaultTenants = async (
	connection: Connection
): Promise<Tenant> => {
	const tenant = {
		name: 'Ever'
	};
	await insertTenants(connection, [tenant]);
	return tenant;
};

export const createRandomTenants = async (
	connection: Connection,
	noOfTenants: number = 0
): Promise<Tenant[]> => {
	const randomTenants: Tenant[] = [];

	for (let i = 0; i < noOfTenants; i++) {
		randomTenants.push({
			name: faker.company.companyName()
		});
	}

	await insertTenants(connection, randomTenants);

	return randomTenants;
};

const insertTenants = async (
	connection: Connection,
	tenant: Tenant[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Tenant)
		.values(tenant)
		.execute();
};
