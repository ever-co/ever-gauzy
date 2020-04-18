import { OrganizationVendorEnum, Organization } from '@gauzy/models';
import { Connection } from 'typeorm';
import { OrganizationVendor } from './organization-vendors.entity';
import { Tenant } from '../tenant/tenant.entity';

export const createOrganizationVendors = async (
	connection: Connection,
	organizations: Organization[]
): Promise<OrganizationVendor[]> => {
	let defaultOrganizationVendors: OrganizationVendor[] = [];

	organizations.forEach((organization) => {
		const vendors = Object.values(OrganizationVendorEnum).map((name) => ({
			name,
			organizationId: organization.id
		}));

		defaultOrganizationVendors = [
			...defaultOrganizationVendors,
			...vendors
		];
	});

	insertOrganizationVendors(connection, defaultOrganizationVendors);

	return defaultOrganizationVendors;
};

export const createRandomOrganizationVendors = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<Map<Organization, OrganizationVendor[]>> => {
	let organizationVendors: OrganizationVendor[] = [];
	const organizationVendorsMap: Map<
		Organization,
		OrganizationVendor[]
	> = new Map();

	(tenants || []).forEach((tenant) => {
		const organizations = tenantOrganizationsMap.get(tenant);

		(organizations || []).forEach((organization) => {
			const vendors = Object.values(OrganizationVendorEnum).map(
				(name) => ({
					name,
					organizationId: organization.id
				})
			);

			organizationVendorsMap.set(organization, vendors);
			organizationVendors = [...organizationVendors, ...vendors];
		});
	});

	await insertOrganizationVendors(connection, organizationVendors);

	return organizationVendorsMap;
};

const insertOrganizationVendors = async (
	connection: Connection,
	organizationVendors: OrganizationVendor[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationVendor)
		.values(organizationVendors)
		.execute();
};
