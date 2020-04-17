import { Connection } from 'typeorm';
import { environment as env } from '@env-api/environment';
import { Organization } from './organization.entity';
import * as faker from 'faker';
import { getDummyImage } from '../core';
import {
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	BonusTypeEnum
} from '@gauzy/models';
import { Tenant } from './../tenant/tenant.entity';

export const createOrganizations = async (
	connection: Connection,
	tenant: Tenant
): Promise<{
	defaultOrganization: Organization;
	randomOrganizations: Organization[];
}> => {
	const defaultOrganization = new Organization();
	const {
		name,
		currency,
		defaultValueDateType,
		imageUrl
	} = env.defaultOrganization;
	const currencies = Object.values(CurrenciesEnum);
	const defaultDateTypes = Object.values(DefaultValueDateTypeEnum);
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

	await insertOrganization(connection, defaultOrganization);

	const randomOrganizations: Organization[] = [];

	for (let index = 0; index < 5; index++) {
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

		await insertOrganization(connection, organization);
		randomOrganizations.push(organization);
	}

	return { defaultOrganization, randomOrganizations };
};

const insertOrganization = async (
	connection: Connection,
	organization: Organization
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Organization)
		.values(organization)
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
	return name.replace(/[^A-Z0-9]+/gi, '_').toLowerCase();
};
