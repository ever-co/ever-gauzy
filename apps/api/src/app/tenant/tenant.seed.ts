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

	for (let i = 0; i < tenants.length; i++) {
		await insertTenant(connection, tenants[i]);
	}

	return tenants;
};

const insertTenant = async (
	connection: Connection,
	tenant: Tenant
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Tenant)
		.values(tenant)
		.execute();
};
