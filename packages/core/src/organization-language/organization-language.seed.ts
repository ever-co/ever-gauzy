import { Connection, In } from 'typeorm';
import { OrganizationLanguage } from './organization-language.entity';
import * as faker from 'faker';
import { IOrganization, IOrganizationLanguage, ITenant } from '@gauzy/contracts';
import { Language } from '../language/language.entity';
import { DEFAULT_LANGUAGE_LEVEL, DEFAULT_ORGANIZATION_LANGUAGES } from './default-organization-languages';

export const createDefaultOrganizationLanguage = async (
	connection: Connection,
	tenant: ITenant,
	defaultOrganizations: IOrganization[]
): Promise<IOrganizationLanguage[]> => {
	const mapOrganizationLanguage: IOrganizationLanguage[] = [];
	
	const allLanguage = await connection.getRepository(Language).find({
		code: In(["en", "he", "ru", "bg"])
	});
	
	for (const defaultOrganization of defaultOrganizations) {
		for (const language of allLanguage) {
			const organization = new OrganizationLanguage();
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
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IOrganizationLanguage[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, organization language not be created'
		);
		return;
	}

	const mapOrganizationLanguage: IOrganizationLanguage[] = [];
	const allLanguage = await connection.manager.createQueryBuilder(Language, "language")
	.orderBy("random()")
	.limit(4)
	.getMany();
	
	for (const tenant of tenants) {
		const tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			const language = faker.random.arrayElement(allLanguage);
			const organization = new OrganizationLanguage();
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
	data: IOrganizationLanguage[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationLanguage)
		.values(data)
		.execute();
};
