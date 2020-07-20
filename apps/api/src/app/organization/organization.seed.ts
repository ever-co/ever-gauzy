import { Connection } from 'typeorm';
import { Organization } from './organization.entity';
import * as faker from 'faker';
import { getDummyImage } from '../core';
import {
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	BonusTypeEnum
} from '@gauzy/models';
import { Tenant } from './../tenant/tenant.entity';

const defaultOrganizationsData = [
    {
      name: 'Ever Technologies LTD',
      currency: CurrenciesEnum.BGN,
      defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
      imageUrl: 'assets/images/logos/ever-large.jpg'
    },
    {
      name: 'Ever Co. Ltd',
      currency: CurrenciesEnum.BGN,
      defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
      imageUrl: 'assets/images/logos/ever-large.jpg'
    }
    ];

export const createDefaultOrganizations = async (
	connection: Connection,
	tenant: Tenant
): Promise<Organization[]> => {
	const defaultOrganizations: Organization[] = [];

  defaultOrganizationsData.forEach((organiziation) => {
		const defaultOrganization: Organization = new Organization();

		const {
			name,
			currency,
			defaultValueDateType,
			imageUrl
		} = organiziation;

		defaultOrganization.name = name;
		defaultOrganization.profile_link = generateLink(name);
		defaultOrganization.currency = currency;
		defaultOrganization.defaultValueDateType = defaultValueDateType;
		defaultOrganization.imageUrl = imageUrl;
		defaultOrganization.tenant = tenant;
		defaultOrganization.invitesAllowed = true;
		defaultOrganization.bonusType = BonusTypeEnum.REVENUE_BASED_BONUS;
		defaultOrganization.bonusPercentage = 10;
		defaultOrganization.registrationDate = faker.date.past(5);

		defaultOrganizations.push(defaultOrganization);
	});

	await insertOrganizations(connection, defaultOrganizations);

	return defaultOrganizations;
};

export const createRandomOrganizations = async (
	connection: Connection,
	tenants: Tenant[],
	noOfOrganizations: number
): Promise<Map<Tenant, Organization[]>> => {
	const currencies = Object.values(CurrenciesEnum);
	const defaultDateTypes = Object.values(DefaultValueDateTypeEnum);

	const tenantOrganizations: Map<Tenant, Organization[]> = new Map();
	let allOrganizations: Organization[] = [];

	tenants.forEach((tenant) => {
		const randomOrganizations: Organization[] = [];

		for (let index = 0; index < noOfOrganizations; index++) {
			const organization = new Organization();
			const companyName = faker.company.companyName();

			const logoAbbreviation = _extractLogoAbbreviation(companyName);

			organization.name = companyName;
			organization.profile_link = generateLink(companyName);
			organization.currency = currencies[index % currencies.length];
			organization.defaultValueDateType =
				defaultDateTypes[index % defaultDateTypes.length];
			organization.imageUrl = getDummyImage(330, 300, logoAbbreviation);
			organization.tenant = tenant;
			organization.invitesAllowed = true;

			const { bonusType, bonusPercentage } = randomBonus();
			organization.bonusType = bonusType;
			organization.bonusPercentage = bonusPercentage;
			organization.registrationDate = faker.date.past(
				Math.floor(Math.random() * 10) + 1
			);

			randomOrganizations.push(organization);
		}

		allOrganizations = allOrganizations.concat(randomOrganizations);
		tenantOrganizations.set(tenant, randomOrganizations);
	});

	await insertOrganizations(connection, allOrganizations);

	return tenantOrganizations;
};

const insertOrganizations = async (
	connection: Connection,
	organizations: Organization[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Organization)
		.values(organizations)
		.execute();
};

const _extractLogoAbbreviation = (companyName: string) => {
	const logoFirstWordFirstLetterIndex = 0;
	const companyNameLastEmptyLetterIndex = companyName.lastIndexOf(' ');
	const logoFirstLetter = companyName[logoFirstWordFirstLetterIndex];

	let logoAbbreviation = logoFirstLetter;

	if (
		companyNameLastEmptyLetterIndex !== -1 &&
		companyNameLastEmptyLetterIndex !== logoFirstWordFirstLetterIndex
	) {
		const logoLastWordFirstLetterIndex =
			companyNameLastEmptyLetterIndex + 1;
		const logoSecondLetter = companyName[logoLastWordFirstLetterIndex];

		logoAbbreviation += logoSecondLetter;
	}

	return logoAbbreviation;
};

const randomBonus = () => {
	const randomNumberBetween = (min, max) =>
		Math.floor(Math.random() * (max - min + 1) + min);

	const bonusType = Object.values(BonusTypeEnum)[randomNumberBetween(0, 1)];

	const bonusPercentage =
		bonusType === BonusTypeEnum.PROFIT_BASED_BONUS
			? randomNumberBetween(65, 75)
			: randomNumberBetween(5, 10);

	return { bonusType, bonusPercentage };
};

const generateLink = (name) => {
	return name.replace(/[^A-Z0-9]+/gi, '-').toLowerCase();
};
