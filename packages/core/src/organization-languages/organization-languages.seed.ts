import { Connection } from 'typeorm';
import { OrganizationLanguages } from './organization-languages.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization, IOrganizationLanguages } from '@gauzy/contracts';
import { Language } from '../language/language.entity';
import { DEFAULT_LANGUAGE_LEVEL, DEFAULT_ORGANIZATION_LANGUAGES } from './default-organization-languages';

export const createDefaultOrganizationLanguage = async (
	connection: Connection,
	tenant: Tenant,
	defaultOrganizations: IOrganization[]
): Promise<IOrganizationLanguages[]> => {
	const mapOrganizationLanguage: IOrganizationLanguages[] = [];
	const allLanguage = await connection.manager.find(Language, {});

	for (const defaultOrganization of defaultOrganizations) {
		for (const language of allLanguage) {
			const organization = new OrganizationLanguages();
			organization.organization = defaultOrganization;
			organization.tenant = tenant;
			organization.language = language;
			organization.name = language.name;
			organization.level = DEFAULT_ORGANIZATION_LANGUAGES[language.name] || DEFAULT_LANGUAGE_LEVEL;
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
): Promise<IOrganizationLanguages[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, organization language not be created'
		);
		return;
	}

	const mapOrganizationLanguage: IOrganizationLanguages[] = [];
	const allLanguage = await connection.manager.find(Language, {});

	for (const tenant of tenants) {
		const tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			const language = faker.random.arrayElement(allLanguage);
			const organization = new OrganizationLanguages();
			organization.organization = tenantOrg;
			organization.tenant = tenant;
			organization.language = language;
			organization.name = language.name;
			organization.level = DEFAULT_ORGANIZATION_LANGUAGES[language.name] || DEFAULT_LANGUAGE_LEVEL;
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
