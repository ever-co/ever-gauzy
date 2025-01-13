import { chain } from 'underscore';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
	DefaultValueDateTypeEnum,
	BonusTypeEnum,
	WeekDaysEnum,
	AlignmentOptions,
	IOrganization,
	ITenant,
	DEFAULT_DATE_FORMATS,
	ISkill,
	IContact
} from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { getRandomElement } from '@gauzy/utils';
import { getDummyImage } from '../core/utils';
import { Contact, Organization, Skill } from '../core/entities/internal';

/**
 * Retrieves the default organization for a given tenant.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant for which the default organization is retrieved.
 * @returns A promise that resolves to the default organization if it exists, otherwise `null`.
 */
export const getDefaultOrganization = async (
    dataSource: DataSource,
    tenant: ITenant
): Promise<IOrganization | null> => {
    if (!tenant?.id) {
        throw new Error('Invalid tenant: Tenant ID is required.');
    }

    return dataSource.getRepository(Organization).findOne({
        where: { tenantId: tenant.id, isDefault: true },
    });
};

/**
 * Retrieves all organizations for a given tenant.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant for which the organizations are retrieved.
 * @returns A promise that resolves to an array of organizations for the specified tenant.
 * @throws Error if the tenant ID is not provided or invalid.
 */
export const getDefaultOrganizations = async (
    dataSource: DataSource,
    tenant: ITenant
): Promise<IOrganization[]> => {
    if (!tenant?.id) {
        throw new Error('Invalid tenant: Tenant ID is required.');
    }

    return dataSource.getRepository(Organization).find({
        where: { tenantId: tenant.id },
    });
};

let defaultOrganizationsInserted = [];

/**
 * Creates default organizations for a tenant.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant to associate the organizations with.
 * @param organizations - An array of organization input data.
 * @returns A promise that resolves to the created organizations.
 */
export const createDefaultOrganizations = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: any
): Promise<Organization[]> => {
	if (!tenant) {
        throw new Error('Tenant is required to create default organizations.');
    }

	const defaultOrganizations: IOrganization[] = [];
	const skills = await getRandomSkills(dataSource, faker.number.int({ min: 1, max: 4 }));
    const contacts = await getRandomContacts(dataSource);

	for (const organization of organizations) {
        const { name, currency, defaultValueDateType, imageUrl, isDefault, totalEmployees } = organization;

        const defaultOrganization = new Organization();
        defaultOrganization.name = name;
        defaultOrganization.isDefault = isDefault || false;
        defaultOrganization.totalEmployees = totalEmployees || 0;
        defaultOrganization.profile_link = generateLink(name);
        defaultOrganization.currency = currency || 'USD';
        defaultOrganization.defaultValueDateType = defaultValueDateType || 'CURRENT_DATE';
		defaultOrganization.imageUrl = imageUrl;
        defaultOrganization.invitesAllowed = true;
        defaultOrganization.bonusType = BonusTypeEnum.REVENUE_BASED_BONUS;
        defaultOrganization.bonusPercentage = 10;
        defaultOrganization.registrationDate = faker.date.past({ years: 5 });
        defaultOrganization.overview = faker.lorem.sentence();
        defaultOrganization.short_description = faker.lorem.sentence();
        defaultOrganization.client_focus = faker.lorem.sentence();
        defaultOrganization.show_profits = false;
        defaultOrganization.show_bonuses_paid = false;
        defaultOrganization.show_income = false;
        defaultOrganization.show_total_hours = false;
        defaultOrganization.show_projects_count = true;
        defaultOrganization.show_minimum_project_size = true;
        defaultOrganization.show_clients_count = true;
        defaultOrganization.show_clients = true;
        defaultOrganization.show_employees_count = true;
        defaultOrganization.banner = faker.lorem.sentence();
        defaultOrganization.skills = skills;
        defaultOrganization.brandColor = faker.internet.color();
        defaultOrganization.timeZone = faker.helpers.arrayElement(
            timezone.tz.names().filter((zone) => zone.includes('/'))
        );
        defaultOrganization.dateFormat = faker.helpers.arrayElement(DEFAULT_DATE_FORMATS);
        defaultOrganization.contact = getRandomElement(contacts);
        defaultOrganization.defaultAlignmentType = faker.helpers.arrayElement(Object.keys(AlignmentOptions));
        defaultOrganization.fiscalStartDate = moment().add(faker.number.int(10), 'days').toDate();
        defaultOrganization.fiscalEndDate = moment(defaultOrganization.fiscalStartDate)
            .add(faker.number.int({ min: 10, max: 20 }), 'days')
            .toDate();
        defaultOrganization.futureDateAllowed = true;
        defaultOrganization.inviteExpiryPeriod = faker.number.int(50);
        defaultOrganization.numberFormat = faker.helpers.arrayElement(['USD', 'BGN', 'ILS']);
        defaultOrganization.officialName = faker.company.name();
        defaultOrganization.separateInvoiceItemTaxAndDiscount = faker.datatype.boolean();
        defaultOrganization.startWeekOn = WeekDaysEnum.MONDAY;
        defaultOrganization.tenant = tenant;
        defaultOrganization.valueDate = moment().add(faker.number.int(10), 'days').toDate();

        defaultOrganizations.push(defaultOrganization);
    }

	await insertOrganizations(dataSource, defaultOrganizations);
	defaultOrganizationsInserted = [...defaultOrganizations];

	return defaultOrganizationsInserted;
};

/**
 * Creates random organizations for multiple tenants.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenants - The list of tenants for which organizations will be created.
 * @param organizationsPerTenant - The number of organizations to create per tenant.
 * @returns A promise that resolves to a map of tenants and their corresponding organizations.
 */
export const createRandomOrganizations = async (
    dataSource: DataSource,
    tenants: ITenant[],
    organizationsPerTenant: number
): Promise<Map<ITenant, IOrganization[]>> => {
    if (!tenants || tenants.length === 0) {
        throw new Error('Tenants are required to create random organizations.');
    }

    const skills = await getRandomSkills(dataSource, faker.number.int({ min: 1, max: 4 }));
    const defaultDateTypes = Object.values(DefaultValueDateTypeEnum);
    const tenantOrganizations: Map<ITenant, IOrganization[]> = new Map();

    for await (const tenant of tenants) {
        const randomOrganizations: IOrganization[] = [];

        if (tenant.name === 'Ever') {
            tenantOrganizations.set(tenant, defaultOrganizationsInserted);
        } else {
            for (let index = 0; index < organizationsPerTenant; index++) {
                const organization = await generateRandomOrganization(
                    tenant,
                    index === 0, // Set the first organization as default
                    defaultDateTypes[index % defaultDateTypes.length],
                    skills,
                    dataSource
                );
                randomOrganizations.push(organization);
            }

			await insertOrganizations(dataSource, randomOrganizations);
            tenantOrganizations.set(tenant, randomOrganizations);
        }
    }

    return tenantOrganizations;
};


/**
 * Generates a random organization entity.
 *
 * @param tenant - The tenant to associate the organization with.
 * @param isDefault - Whether the organization is the default for the tenant.
 * @param defaultValueDateType - The default value date type for the organization.
 * @param skills - Pre-generated skills to assign to the organization.
 * @param dataSource - The TypeORM data source (for fetching random contact).
 * @returns A randomly generated organization entity.
 */
const generateRandomOrganization = async (
    tenant: ITenant,
    isDefault: boolean,
    defaultValueDateType: DefaultValueDateTypeEnum,
    skills: ISkill[],
    dataSource: DataSource
): Promise<IOrganization> => {
    const timeZone = faker.helpers.arrayElement(timezone.tz.names().filter((zone) => zone.includes('/')));
    const companyName = faker.company.name();
    const logoAbbreviation = _extractLogoAbbreviation(companyName);
    const contacts = await getRandomContacts(dataSource);
    const { bonusType, bonusPercentage } = randomBonus();

    const organization = new Organization();
    organization.name = companyName;
    organization.isDefault = isDefault;
    organization.totalEmployees = 5;
    organization.profile_link = generateLink(companyName);
    organization.currency = env.defaultCurrency;
    organization.defaultValueDateType = defaultValueDateType;
    organization.imageUrl = getDummyImage(330, 300, logoAbbreviation);
    organization.invitesAllowed = true;
    organization.bonusType = bonusType;
    organization.bonusPercentage = bonusPercentage;
    organization.registrationDate = faker.date.past({ years: Math.floor(Math.random() * 10) + 1 });
    organization.overview = faker.lorem.sentence();
    organization.short_description = faker.lorem.sentence();
    organization.client_focus = faker.lorem.sentence();
    organization.show_profits = false;
    organization.show_bonuses_paid = false;
    organization.show_income = false;
    organization.show_total_hours = false;
    organization.show_projects_count = true;
    organization.show_minimum_project_size = true;
    organization.show_clients_count = true;
    organization.show_employees_count = true;
    organization.banner = faker.lorem.sentence();
    organization.skills = skills;
    organization.brandColor = faker.internet.color();
    organization.contact = getRandomElement(contacts);
    organization.timeZone = timeZone;
    organization.dateFormat = faker.helpers.arrayElement(DEFAULT_DATE_FORMATS);
    organization.defaultAlignmentType = faker.helpers.arrayElement(Object.keys(AlignmentOptions));
    organization.fiscalStartDate = moment().add(faker.number.int(10), 'days').toDate();
    organization.fiscalEndDate = moment(organization.fiscalStartDate)
        .add(faker.number.int(10), 'days')
        .toDate();
    organization.futureDateAllowed = true;
    organization.inviteExpiryPeriod = faker.number.int(50);
    organization.numberFormat = faker.helpers.arrayElement(['USD', 'BGN', 'ILS']);
    organization.officialName = faker.company.name();
    organization.separateInvoiceItemTaxAndDiscount = faker.datatype.boolean();
    organization.startWeekOn = WeekDaysEnum.MONDAY;
    organization.tenant = tenant;
    organization.valueDate = moment().add(faker.number.int(10), 'days').toDate();

    return organization;
};

/**
 * Inserts multiple organizations into the database.
 *
 * @param dataSource - The TypeORM data source.
 * @param organizations - An array of organizations to be inserted.
 * @returns A promise that resolves once the organizations are successfully inserted.
 * @throws Error if the `organizations` array is empty or invalid.
 */
const insertOrganizations = async (
    dataSource: DataSource,
    organizations: IOrganization[]
): Promise<void> => {
    if (!organizations || organizations.length === 0) {
        throw new Error('The organizations array must not be empty.');
    }

    try {
        await dataSource.manager.save(organizations);
    } catch (error) {
        throw new Error(`Failed to insert organizations: ${error.message}`);
    }
};

/**
 * Extracts an abbreviation for a company logo based on its name.
 * - If the company name has only one word, returns the first letter.
 * - If the company name has multiple words, returns the first letter of the first and last words.
 *
 * @param companyName - The full name of the company.
 * @returns The logo abbreviation as a string.
 * @throws Error if `companyName` is empty or not a valid string.
 */
const _extractLogoAbbreviation = (companyName: string): string => {
    if (!companyName || typeof companyName !== 'string') {
        throw new Error('Invalid company name. A non-empty string is required.');
    }

    const trimmedName = companyName.trim();
    const words = trimmedName.split(/\s+/); // Split by one or more spaces

    // Get the first letter of the first word
    const firstLetter = words[0][0];

    // Get the first letter of the last word if there are multiple words
    const lastLetter = words.length > 1 ? words[words.length - 1][0] : '';

    return `${firstLetter}${lastLetter}`.toUpperCase();
};


/**
 * Generates a random bonus type and percentage.
 *
 * @returns An object containing the bonus type and the corresponding percentage.
 */
const randomBonus = (): { bonusType: BonusTypeEnum; bonusPercentage: number } => {
    const randomNumberBetween = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1) + min);

    const bonusType = Object.values(BonusTypeEnum)[randomNumberBetween(0, 1)];
    const bonusPercentage =
        bonusType === BonusTypeEnum.PROFIT_BASED_BONUS
            ? randomNumberBetween(65, 75)
            : randomNumberBetween(5, 10);

    return { bonusType, bonusPercentage };
};

/**
 * Generates a URL-friendly slug from a given name.
 *
 * @param name - The name to be converted into a slug.
 * @returns The generated slug as a string.
 */
const generateLink = (name: string): string => {
    if (!name) {
        throw new Error('Name is required to generate a link.');
    }
    return name.replace(/[^A-Z0-9]+/gi, '-').toLowerCase();
};

/**
 * Retrieves a random subset of skills from the database.
 *
 * @param dataSource - The TypeORM data source to query the skills.
 * @param count - The number of random skills to retrieve.
 * @returns A promise that resolves to an array of randomly selected skills.
 * @throws Error if there is an issue retrieving skills from the database.
 */
const getRandomSkills = async (
    dataSource: DataSource,
    count: number
): Promise<ISkill[]> => {
    if (!dataSource) {
        throw new Error('Invalid data source: DataSource is required.');
    }

    // Retrieve all skills from the database
    const skills = await dataSource.manager.find(Skill, {});

    // Shuffle and select a subset of skills
    return chain(skills).shuffle().take(count).value();
};

/**
 * Retrieves all contacts from the database.
 *
 * @param dataSource - The TypeORM data source used for database operations.
 * @returns A promise that resolves to an array of contacts.
 * @throws Error if the data source is invalid or contacts cannot be retrieved.
 */
const getRandomContacts = async (dataSource: DataSource): Promise<IContact[]> => {
    if (!dataSource) {
        throw new Error('Invalid data source: DataSource is required.');
    }

    // Retrieve all contacts from the database
    return await dataSource.getRepository(Contact).find();
};
