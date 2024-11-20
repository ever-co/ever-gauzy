import * as _ from 'underscore';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { getDummyImage } from '../core';
import {
	DefaultValueDateTypeEnum,
	BonusTypeEnum,
	WeekDaysEnum,
	AlignmentOptions,
	IOrganizationCreateInput,
	IOrganization,
	ITenant,
	DEFAULT_DATE_FORMATS
} from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { Contact, Organization, Skill } from '../core/entities/internal';

export const getDefaultOrganization = async (dataSource: DataSource, tenant: ITenant): Promise<IOrganization> => {
	const repo = dataSource.getRepository(Organization);
	const existedOrganization = await repo.findOne({
		where: { tenantId: tenant.id, isDefault: true }
	});
	return existedOrganization;
};

export const getDefaultOrganizations = async (dataSource: DataSource, tenant: ITenant): Promise<IOrganization[]> => {
	const repo = dataSource.getRepository(Organization);
	const organizations = await repo.find({
		where: { tenantId: tenant.id }
	});
	return organizations;
};

let defaultOrganizationsInserted = [];

export const createDefaultOrganizations = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: any
): Promise<Organization[]> => {
	const defaultOrganizations: IOrganization[] = [];
	const skills = await getSkills(dataSource);
	const contacts = await getContacts(dataSource);

	organizations.forEach((organization: IOrganizationCreateInput) => {
		const organizationSkills = _.chain(skills)
			.shuffle()
			.take(faker.number.int({ min: 1, max: 4 }))
			.values()
			.value();
		const defaultOrganization: IOrganization = new Organization();
		const { name, currency, defaultValueDateType, imageUrl, isDefault, totalEmployees } = organization;
		defaultOrganization.name = name;
		defaultOrganization.isDefault = isDefault;
		defaultOrganization.totalEmployees = totalEmployees;
		defaultOrganization.profile_link = generateLink(name);
		defaultOrganization.currency = currency;
		defaultOrganization.defaultValueDateType = defaultValueDateType;
		defaultOrganization.imageUrl = imageUrl;
		defaultOrganization.invitesAllowed = true;
		defaultOrganization.bonusType = BonusTypeEnum.REVENUE_BASED_BONUS;
		defaultOrganization.bonusPercentage = 10;
		defaultOrganization.registrationDate = faker.date.past({ years: 5 });
		defaultOrganization.overview = faker.person.jobDescriptor();
		defaultOrganization.short_description = faker.person.jobDescriptor();
		defaultOrganization.client_focus = faker.person.jobDescriptor();
		defaultOrganization.show_profits = false;
		defaultOrganization.show_bonuses_paid = false;
		defaultOrganization.show_income = false;
		defaultOrganization.show_total_hours = false;
		defaultOrganization.show_projects_count = true;
		defaultOrganization.show_minimum_project_size = true;
		defaultOrganization.show_clients_count = true;
		defaultOrganization.show_clients = true;
		defaultOrganization.show_employees_count = true;
		defaultOrganization.banner = faker.person.jobDescriptor();
		defaultOrganization.skills = organizationSkills;
		defaultOrganization.brandColor = faker.helpers.arrayElement([
			'#FF0000',
			'#008000',
			'#0000FF',
			'#FFA500',
			'#FFFF00'
		]);
		defaultOrganization.contact = faker.helpers.arrayElement(contacts);
		defaultOrganization.timeZone = faker.helpers.arrayElement(
			timezone.tz.names().filter((zone) => zone.includes('/'))
		);
		defaultOrganization.dateFormat = faker.helpers.arrayElement(DEFAULT_DATE_FORMATS);
		defaultOrganization.defaultAlignmentType = faker.helpers.arrayElement(Object.keys(AlignmentOptions));
		defaultOrganization.fiscalStartDate = moment(new Date()).add(faker.number.int(10), 'days').toDate();
		defaultOrganization.fiscalEndDate = moment(defaultOrganization.fiscalStartDate)
			.add(faker.number.int(10), 'days')
			.toDate();
		defaultOrganization.futureDateAllowed = true;
		defaultOrganization.inviteExpiryPeriod = faker.number.int(50);
		defaultOrganization.numberFormat = faker.helpers.arrayElement(['USD', 'BGN', 'ILS']);
		defaultOrganization.officialName = faker.company.name();
		defaultOrganization.separateInvoiceItemTaxAndDiscount = faker.datatype.boolean();
		defaultOrganization.startWeekOn = WeekDaysEnum.MONDAY;
		defaultOrganization.tenant = tenant;
		defaultOrganization.valueDate = moment(new Date()).add(faker.number.int(10), 'days').toDate();

		defaultOrganizations.push(defaultOrganization);
	});

	await dataSource.manager.save(defaultOrganizations);
	defaultOrganizationsInserted = [...defaultOrganizations];
	return defaultOrganizationsInserted;
};

export const createRandomOrganizations = async (
	dataSource: DataSource,
	tenants: ITenant[],
	organizationsPerTenant: number
): Promise<Map<ITenant, IOrganization[]>> => {
	const defaultDateTypes = Object.values(DefaultValueDateTypeEnum);
	const skills = await getSkills(dataSource);
	const contacts = await getContacts(dataSource);
	const tenantOrganizations: Map<ITenant, IOrganization[]> = new Map();

	for await (const tenant of tenants) {
		const randomOrganizations: IOrganization[] = [];
		if (tenant.name === 'Ever') {
			tenantOrganizations.set(tenant, defaultOrganizationsInserted);
		} else {
			for (let index = 0; index < organizationsPerTenant; index++) {
				const organizationSkills = _.chain(skills)
					.shuffle()
					.take(faker.number.int({ min: 1, max: 4 }))
					.values()
					.value();
				const organization: IOrganization = new Organization();
				const companyName = faker.company.name();

				const logoAbbreviation = _extractLogoAbbreviation(companyName);

				organization.name = companyName;
				organization.isDefault = index === 0 || false;
				organization.totalEmployees = 5; //No of random employees seeded will be (employeesPerOrganization * organizationsPerTenant * tenants)
				organization.profile_link = generateLink(companyName);
				organization.currency = env.defaultCurrency;
				organization.defaultValueDateType = defaultDateTypes[index % defaultDateTypes.length];
				organization.imageUrl = getDummyImage(330, 300, logoAbbreviation);
				organization.invitesAllowed = true;
				organization.overview = faker.person.jobDescriptor();
				organization.short_description = faker.person.jobDescriptor();
				organization.client_focus = faker.person.jobDescriptor();
				organization.show_profits = false;
				organization.show_bonuses_paid = false;
				organization.show_income = false;
				organization.show_total_hours = false;
				organization.show_projects_count = true;
				organization.show_minimum_project_size = true;
				organization.show_clients_count = true;
				organization.show_employees_count = true;
				organization.banner = faker.person.jobDescriptor();

				const { bonusType, bonusPercentage } = randomBonus();
				organization.bonusType = bonusType;
				organization.bonusPercentage = bonusPercentage;
				organization.registrationDate = faker.date.past({
					years: Math.floor(Math.random() * 10) + 1
				});

				organization.skills = organizationSkills;
				organization.brandColor = faker.helpers.arrayElement([
					'#FF0000',
					'#008000',
					'#0000FF',
					'#FFA500',
					'#FFFF00'
				]);
				organization.contact = faker.helpers.arrayElement(contacts);
				organization.timeZone = faker.helpers.arrayElement(
					timezone.tz.names().filter((zone) => zone.includes('/'))
				);
				organization.dateFormat = faker.helpers.arrayElement(DEFAULT_DATE_FORMATS);
				organization.defaultAlignmentType = faker.helpers.arrayElement(Object.keys(AlignmentOptions));
				organization.fiscalStartDate = moment(new Date()).add(faker.number.int(10), 'days').toDate();
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
				organization.valueDate = moment(new Date()).add(faker.number.int(10), 'days').toDate();

				randomOrganizations.push(organization);
			}
			tenantOrganizations.set(tenant, randomOrganizations);
		}
		await insertOrganizations(dataSource, randomOrganizations);
	}
	return tenantOrganizations;
};

const insertOrganizations = async (dataSource: DataSource, organizations: IOrganization[]): Promise<void> => {
	await dataSource.manager.save(organizations);
};

const _extractLogoAbbreviation = (companyName: string) => {
	const logoFirstWordFirstLetterIndex = 0;
	const companyNameLastEmptyLetterIndex = companyName.lastIndexOf(' ');
	const logoFirstLetter = companyName[logoFirstWordFirstLetterIndex];

	let logoAbbreviation = logoFirstLetter;

	if (companyNameLastEmptyLetterIndex !== -1 && companyNameLastEmptyLetterIndex !== logoFirstWordFirstLetterIndex) {
		const logoLastWordFirstLetterIndex = companyNameLastEmptyLetterIndex + 1;
		const logoSecondLetter = companyName[logoLastWordFirstLetterIndex];

		logoAbbreviation += logoSecondLetter;
	}

	return logoAbbreviation;
};

const randomBonus = () => {
	const randomNumberBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

	const bonusType = Object.values(BonusTypeEnum)[randomNumberBetween(0, 1)];

	const bonusPercentage =
		bonusType === BonusTypeEnum.PROFIT_BASED_BONUS ? randomNumberBetween(65, 75) : randomNumberBetween(5, 10);

	return { bonusType, bonusPercentage };
};

const generateLink = (name) => {
	return name.replace(/[^A-Z0-9]+/gi, '-').toLowerCase();
};

const getSkills = async (dataSource: DataSource): Promise<any> => {
	return await dataSource.manager.find(Skill, {});
};

const getContacts = async (dataSource: DataSource): Promise<Contact[]> => {
	return await dataSource.manager.find(Contact, {});
};
