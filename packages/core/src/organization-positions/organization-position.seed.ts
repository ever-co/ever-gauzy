import { Connection } from 'typeorm';
import { OrganizationPositions } from './organization-positions.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_ORGANIZATION_POSITIONS } from './default-organization-positions';

export const seedDefaultOrganizationPosition = async (
	connection: Connection,
	tenant: Tenant,
	organizations
): Promise<void> => {
	let positions: OrganizationPositions[] = [];

	const organizationPositions: OrganizationPositions[] = DEFAULT_ORGANIZATION_POSITIONS.map(
		(name) => {
			const employmentPosition = new OrganizationPositions();
			employmentPosition.name = name;
			employmentPosition.organizationId = organizations.id;
			employmentPosition.tenant = tenant;
			return employmentPosition;
		}
	);
	positions = [...positions, ...organizationPositions];
	await insertEmploymentPosition(connection, positions);
};

export const seedRandomOrganizationPosition = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<void> => {
	let positions: OrganizationPositions[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach(({ id: organizationId }) => {
			const organizationPositions: OrganizationPositions[] = DEFAULT_ORGANIZATION_POSITIONS.map(
				(name) => {
					const employmentPosition = new OrganizationPositions();
					employmentPosition.name = name;
					employmentPosition.organizationId = organizationId;
					employmentPosition.tenant = tenant;
					return employmentPosition;
				}
			);
			positions = [...positions, ...organizationPositions];
		});
		await insertEmploymentPosition(connection, positions);
	}
};

const insertEmploymentPosition = async (
	connection: Connection,
	employmentPosition: OrganizationPositions[]
): Promise<void> => {
	await connection.manager.save(employmentPosition);
};
