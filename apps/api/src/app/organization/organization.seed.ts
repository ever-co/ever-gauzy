import { Connection } from 'typeorm';
import { environment as env } from '@env-api/environment';
import { Organization } from './organization.entity';
import * as faker from 'faker';
import { getDummyImage } from '../core';
import { CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/models';

export const createOrganizations = async (
  connection: Connection
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
  defaultOrganization.currency = currency;
  defaultOrganization.defaultValueDateType = defaultValueDateType;
  defaultOrganization.imageUrl = imageUrl;

  await insertOrganization(connection, defaultOrganization);

  const randomOrganizations: Organization[] = [];

  for (let index = 1; index <= 5; index++) {
    const organization = new Organization();
    const companyName = faker.company.companyName();

    const logoAbbreviation = _extractLogoAbbreviation(companyName);

    organization.name = companyName;
    organization.currency = currencies[(index % currencies.length) + 1 - 1];
    organization.defaultValueDateType = defaultDateTypes[(index % defaultDateTypes.length) + 1 - 1];
    organization.imageUrl = getDummyImage(330, 300, logoAbbreviation);

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
    const logoLastWordFirstLetterIndex = companyNameLastEmptyLetterIndex + 1;
    const logoSecondLetter = companyName[logoLastWordFirstLetterIndex];

    logoAbbreviation += logoSecondLetter;
  }

  return logoAbbreviation;
};
