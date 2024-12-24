import { DataSource } from 'typeorm';
import { IOrganization, IOrganizationPosition, ITenant } from '@gauzy/contracts';
import { OrganizationPosition } from './organization-position.entity';
import { DEFAULT_ORGANIZATION_POSITIONS } from './default-organization-positions';

export const seedDefaultOrganizationPosition = async (
	dataSource: DataSource,
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
	await insertEmploymentPosition(dataSource, positions);
};

export const seedRandomOrganizationPosition = async (
	dataSource: DataSource,
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
		await insertEmploymentPosition(dataSource, positions);
	}
};

const insertEmploymentPosition = async (
	dataSource: DataSource,
	organizationPosition: IOrganizationPosition[]
): Promise<void> => {
	await dataSource.manager.save(organizationPosition);
};
