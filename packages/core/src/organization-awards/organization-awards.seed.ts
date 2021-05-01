import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationAwards } from './organization-awards.entity';
import * as faker from 'faker';
import { DEFAULT_ORGANIZATION_AWARDS } from './default-organization-awards';

export const createDefaultAwards = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<OrganizationAwards[]> => {
	const awards: OrganizationAwards[] = [];
	const awardsNames = Object.keys(DEFAULT_ORGANIZATION_AWARDS);
	for (const org of organizations) {
		for (const awardsName of awardsNames) {
			const award = new OrganizationAwards();
			award.name = awardsName;
			award.year = DEFAULT_ORGANIZATION_AWARDS[awardsName];
			award.organization = org;
			award.tenant = tenant;
			awards.push(award);
		}
	}
	return await connection.manager.save(awards);
};

export const createRandomAwards = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<OrganizationAwards[]> => {
	const awards: OrganizationAwards[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		const awardsData = [
			'Best Product',
			'Best Revenue',
			'Best Idea',
			'Rising Star Product'
		];

		for (const org of organizations) {
			for (let i = 0; i < awardsData.length; i++) {
				const award = new OrganizationAwards();
				award.name = awardsData[i];
				award.year = faker.datatype
					.number({ min: 1990, max: 2020 })
					.toString();
				award.organization = org;
				award.tenant = tenant;
				awards.push(award);
			}
		}
	}
	return await connection.manager.save(awards);
};
