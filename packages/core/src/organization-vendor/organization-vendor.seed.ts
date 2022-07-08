import { OrganizationVendorEnum, IOrganization, IOrganizationVendor, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { OrganizationVendor } from './../core/entities/internal';

export const createOrganizationVendors = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<OrganizationVendor[]> => {
	let defaultOrganizationVendors: OrganizationVendor[] = [];
	for (const organization of organizations) {
		const vendors = Object.values(OrganizationVendorEnum).map((name) => ({
			name,
			organizationId: organization.id,
			organization,
			tenant: tenant
		}));

		defaultOrganizationVendors = [
			...defaultOrganizationVendors,
			...vendors
		];
	}
	await insertOrganizationVendors(dataSource, defaultOrganizationVendors);
	return defaultOrganizationVendors;
};

export const createRandomOrganizationVendors = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<Map<IOrganization, IOrganizationVendor[]>> => {
	let organizationVendors: OrganizationVendor[] = [];
	const organizationVendorsMap: Map<
		IOrganization,
		IOrganizationVendor[]
	> = new Map();
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const vendors = Object.values(OrganizationVendorEnum).map(
				(name) => ({
					name,
					organization,
					organizationId: organization.id,
					tenant: organization.tenant
				})
			);
			organizationVendorsMap.set(organization, vendors);
			organizationVendors = [...organizationVendors, ...vendors];
		}
	}
	await insertOrganizationVendors(dataSource, organizationVendors);
	return organizationVendorsMap;
};

const insertOrganizationVendors = async (
	dataSource: DataSource,
	organizationVendors: OrganizationVendor[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(OrganizationVendor)
		.values(organizationVendors)
		.execute();
};
