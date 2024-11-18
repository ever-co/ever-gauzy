import { DataSource } from 'typeorm';
import { Tenant } from './tenant.entity';
import { faker } from '@faker-js/faker';
import { DEFAULT_EVER_TENANT } from './default-tenants';
import { ITenant } from '@gauzy/contracts';

export const getDefaultTenant = async (
	dataSource: DataSource,
	tenantName: string = DEFAULT_EVER_TENANT
): Promise<Tenant> => {
	const repo = dataSource.getRepository(Tenant);
	const existedTenant = await repo.findOne({ where: { name: tenantName } });
	return existedTenant;
};

export const createDefaultTenant = async (
	dataSource: DataSource,
	tenantName: string
): Promise<Tenant> => {
	const tenant: ITenant = {
		name: tenantName
	};
	await insertTenant(dataSource, tenant);
	return tenant;
};

export const createRandomTenants = async (
	dataSource: DataSource,
	noOfTenants: number = 0
): Promise<Tenant[]> => {
	const randomTenants: Tenant[] = [];
	for (let i = 0; i < noOfTenants; i++) {
		const tenant = new Tenant();
		tenant.name = faker.company.name();
		randomTenants.push(tenant);
	}

	return await insertTenants(dataSource, randomTenants);
};

const insertTenant = async (
	dataSource: DataSource,
	tenant: Tenant
): Promise<Tenant> => {
	const repo = dataSource.getRepository(Tenant);

	const existedTenant = await repo.findOne({ where: { name: tenant.name } });

	if (existedTenant) return existedTenant;
	else {
		await dataSource
			.createQueryBuilder()
			.insert()
			.into(Tenant)
			.values(tenant)
			.execute();

		return tenant;
	}
};

const insertTenants = async (
	dataSource: DataSource,
	tenants: Tenant[]
): Promise<Tenant[]> => {
	return await dataSource.manager.save(tenants);
};
