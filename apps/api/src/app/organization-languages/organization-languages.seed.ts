import { Connection } from 'typeorm';
import { OrganizationLanguages } from './organization-languages.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '@gauzy/models';
import * as _ from 'underscore';
import { Language } from '../language/language.entity';

export const createRandomOrganizationLanguage = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<OrganizationLanguages[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, organization language not be created'
		);
		return;
	}

	let mapOrganizationLanguage: OrganizationLanguages[] = [];

	const allLanguage = await connection.manager.find(Language, {});

	for (const tenant of tenants) {
		let tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			const language = faker.random.arrayElement(allLanguage);

			let organization = new OrganizationLanguages();

			organization.organization = tenantOrg;
			organization.language = language;
			organization.name = faker.company.companyName();
			organization.level = faker.name.jobArea();

			mapOrganizationLanguage.push(organization);
		}
	}

	await insertRandomOrganizationLanguage(connection, mapOrganizationLanguage);
	return mapOrganizationLanguage;
};

const insertRandomOrganizationLanguage = async (
	connection: Connection,
	data: OrganizationLanguages[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationLanguages)
		.values(data)
		.execute();
};
