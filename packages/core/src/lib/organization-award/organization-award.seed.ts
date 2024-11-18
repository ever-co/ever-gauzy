import { DataSource } from 'typeorm';
import { OrganizationAward } from './organization-award.entity';
import { faker } from '@faker-js/faker';
import { DEFAULT_ORGANIZATION_AWARDS } from './default-organization-awards';
import { IOrganization, IOrganizationAward, ITenant } from '@gauzy/contracts';

export const createDefaultAwards = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<IOrganizationAward[]> => {
	const awards: IOrganizationAward[] = [];
	const awardsNames = Object.keys(DEFAULT_ORGANIZATION_AWARDS);
	for (const org of organizations) {
		for (const awardsName of awardsNames) {
			const award = new OrganizationAward();
			award.name = awardsName;
			award.year = DEFAULT_ORGANIZATION_AWARDS[awardsName];
			award.organization = org;
			award.tenant = tenant;
			awards.push(award);
		}
	}
	return await dataSource.manager.save(awards);
};

export const createRandomAwards = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IOrganizationAward[]> => {
	const awards: IOrganizationAward[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		const awardsData = [
			'Best Product',
			'Best Revenue',
			'Best Idea',
			'Rising Star Product'
		];

		for (const organization of organizations) {
			for (let i = 0; i < awardsData.length; i++) {
				const award = new OrganizationAward();
				award.name = awardsData[i];
				award.year = faker.number.int({ min: 1990, max: 2020 }).toString();
				award.organization = organization;
				award.tenant = tenant;
				awards.push(award);
			}
		}
	}
	return await dataSource.manager.save(awards);
};
