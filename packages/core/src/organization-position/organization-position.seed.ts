import { Connection } from 'typeorm';
import { IOrganization, IOrganizationPosition, ITenant } from '@gauzy/contracts';
import { OrganizationPosition } from './organization-position.entity';
import { DEFAULT_ORGANIZATION_POSITIONS } from './default-organization-positions';

export const seedDefaultOrganizationPosition = async (
	connection: Connection,
	tenant: ITenant,
	organizations
): Promise<void> => {
	let positions: IOrganizationPosition[] = [];
	const organizationPositions: IOrganizationPosition[] = DEFAULT_ORGANIZATION_POSITIONS.map(
		(name) => {
			const organizationPosition = new OrganizationPosition();
			organizationPosition.name = name;
			organizationPosition.organizationId = organizations.id;
			organizationPosition.tenant = tenant;
			return organizationPosition;
		}
	);
	positions = [...positions, ...organizationPositions];
	await insertEmploymentPosition(connection, positions);
};

export const seedRandomOrganizationPosition = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<void> => {
	let positions: IOrganizationPosition[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach(({ id: organizationId }) => {
			const organizationPositions: IOrganizationPosition[] = DEFAULT_ORGANIZATION_POSITIONS.map(
				(name) => {
					const organizationPosition = new OrganizationPosition();
					organizationPosition.name = name;
					organizationPosition.organizationId = organizationId;
					organizationPosition.tenant = tenant;
					return organizationPosition;
				}
			);
			positions = [...positions, ...organizationPositions];
		});
		await insertEmploymentPosition(connection, positions);
	}
};

const insertEmploymentPosition = async (
	connection: Connection,
	organizationPosition: IOrganizationPosition[]
): Promise<void> => {
	await connection.manager.save(organizationPosition);
};
