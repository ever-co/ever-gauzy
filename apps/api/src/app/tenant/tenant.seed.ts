import { Connection } from 'typeorm';
import { Tenant } from './tenant.entity';

export const createTenant = async (connection: Connection): Promise<Tenant> => {
	const tenant = {
		name: 'Ever'
	};

	await insertTenants(connection, tenant);

	return tenant;
};

const insertTenants = async (
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
