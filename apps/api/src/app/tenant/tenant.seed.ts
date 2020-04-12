import { Connection } from 'typeorm';
import { Tenant } from './tenant.entity';

export const createTenants = async (
	connection: Connection
): Promise<Tenant[]> => {
	const tenants: Tenant[] = [
		{
			name: 'Ever'
		},
		{
			name: 'Google'
		},
		{
			name: 'Yahoo'
		},
		{
			name: 'Youtube'
		}
	];

	await insertTenants(connection, tenants);

	return tenants;
};

const insertTenants = async (
	connection: Connection,
	tenants: Tenant[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Tenant)
		.values(tenants)
		.execute();
};
