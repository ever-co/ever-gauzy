import { OrganizationVendorsEnum } from '@gauzy/models';
import { Connection } from 'typeorm';
import { OrganizationVendors } from '.';

export const createOrganizationVendors = async (
	connection: Connection,
	organizationId: string
): Promise<OrganizationVendors[]> => {
	const defaultOrganizationVendors = Object.values(
		OrganizationVendorsEnum
	).map((name) => ({
		name,
		organizationId
	}));
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationVendors)
		.values(defaultOrganizationVendors)
		.execute();

	return defaultOrganizationVendors;
};
