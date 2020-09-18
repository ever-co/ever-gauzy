import { Connection } from 'typeorm';
import { OrganizationLanguages } from './organization-languages.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization } from '@gauzy/models';
import { Language } from '../language/language.entity';

const defaultLanguageLevel = {
	Bulgarian: 'Native or Bilingual',
	Russian: 'Native or Bilingual',
	Ukrainian: 'Native or Bilingual',
	English: 'Fluent',
	Hebrew: 'Conversational'
};
export const createDefaultOrganizationLanguage = async (
	connection: Connection,
	defaultOrganizations: IOrganization[]
): Promise<OrganizationLanguages[]> => {
	let mapOrganizationLanguage: OrganizationLanguages[] = [];

	const allLanguage = await connection.manager.find(Language, {});

	for (const defaultOrganization of defaultOrganizations) {
		for (const language of allLanguage) {
			let organization = new OrganizationLanguages();

			organization.organization = defaultOrganization;
			organization.language = language;
			organization.name = language.name;
			organization.level = defaultLanguageLevel[language.name]
				? defaultLanguageLevel[language.name]
				: 'intermediate';

			mapOrganizationLanguage.push(organization);
		}
	}

	await insertRandomOrganizationLanguage(connection, mapOrganizationLanguage);
	return mapOrganizationLanguage;
};

export const createRandomOrganizationLanguage = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
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
			organization.name = language.name;
			organization.level = defaultLanguageLevel[language.name]
				? defaultLanguageLevel[language.name]
				: 'intermediate';

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
