import { OrganizationVendorEnum } from '@gauzy/models';
import { Connection } from 'typeorm';
import { OrganizationVendor } from '.';

export const createOrganizationVendors = async (
	connection: Connection,
	organizationId: string
): Promise<OrganizationVendor[]> => {
	const defaultOrganizationVendor = Object.values(OrganizationVendorEnum).map(
		(name) => ({
			name,
			organizationId
		})
	);
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationVendor)
		.values(defaultOrganizationVendor)
		.execute();

	return defaultOrganizationVendor;
};
