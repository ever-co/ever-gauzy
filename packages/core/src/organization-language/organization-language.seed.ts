import { DataSource, In } from 'typeorm';
import { OrganizationLanguage } from './organization-language.entity';
import { faker } from '@ever-co/faker';
import { IOrganization, IOrganizationLanguage, ITenant, LanguagesEnum } from '@gauzy/contracts';
import { Language } from '../language/language.entity';
import { DEFAULT_LANGUAGE_LEVEL, DEFAULT_ORGANIZATION_LANGUAGES } from './default-organization-languages';

export const createDefaultOrganizationLanguage = async (
	dataSource: DataSource,
	tenant: ITenant,
	defaultOrganizations: IOrganization[]
): Promise<IOrganizationLanguage[]> => {
	const mapOrganizationLanguage: IOrganizationLanguage[] = [];
	const allLanguage = await dataSource.getRepository(Language).find({
		where: {
			code: In(Object.values(LanguagesEnum))
		}
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

	await insertRandomOrganizationLanguage(dataSource, mapOrganizationLanguage);
	return mapOrganizationLanguage;
};

export const createRandomOrganizationLanguage = async (
	dataSource: DataSource,
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
	const allLanguage = await dataSource.manager.createQueryBuilder(Language, "language")
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

	await insertRandomOrganizationLanguage(dataSource, mapOrganizationLanguage);
	return mapOrganizationLanguage;
};

const insertRandomOrganizationLanguage = async (
	dataSource: DataSource,
	data: IOrganizationLanguage[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(OrganizationLanguage)
		.values(data)
		.execute();
};
