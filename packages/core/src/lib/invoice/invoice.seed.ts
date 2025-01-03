import { DataSource } from 'typeorm';
import { Invoice } from './invoice.entity';
import { faker } from '@faker-js/faker';
import * as moment from 'moment';
import { chain } from 'underscore';
import {
	DiscountTaxTypeEnum,
	EstimateStatusTypesEnum,
	IInvoice,
	IInvoiceEstimateHistory,
	InvoiceStatusTypesEnum,
	InvoiceTypeEnum,
	IOrganization,
	IOrganizationContact,
	ITag,
	ITenant
} from '@gauzy/contracts';
import { InvoiceEstimateHistory, OrganizationContact, Tag, User } from './../core/entities/internal';
import { randomSeedConfig } from './../core/seeds/random-seed-config';

export const createDefaultInvoice = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	noOfInvoicePerOrganization: number
) => {
	const invoices: IInvoice[] = [];
	const { id: tenantId } = tenant;
	for await (const organization of organizations) {
		const { id: organizationId } = organization;
		const tags = await dataSource.manager.findBy(Tag, {
			organizationId,
			tenantId
		});
		const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
			tenantId,
			organizationId
		});
		for (let i = 0; i < noOfInvoicePerOrganization; i++) {
			const invoice = await generateInvoice(
				dataSource,
				tenant,
				organization,
				tags,
				organizationContacts
			)
			invoices.push(invoice);
		}
	}
	await dataSource.manager.save(invoices);
};

export const createRandomInvoice = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	noOfInvoicePerOrganization: number
) => {
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);
		const invoices: IInvoice[] = [];
		for await (const organization of organizations) {
			const { id: organizationId } = organization;
			const tags = await dataSource.manager.findBy(Tag, {
				organizationId
			});
			const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
				organizationId,
				tenantId
			});
			for (let i = 0; i < noOfInvoicePerOrganization; i++) {
				const invoice = await generateInvoice(dataSource, tenant, organization, tags, organizationContacts)
				invoices.push(invoice);
			}
		}
		await dataSource.manager.save(invoices);
	}
};

const generateInvoice = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	tags: ITag[],
	organizationContacts: IOrganizationContact[]
): Promise<IInvoice> => {

	const invoice = new Invoice();
	invoice.invoiceNumber = faker.number.int({ min: 111111111111, max: 999999999999 });

	invoice.tags = chain(tags)
		.shuffle()
		.take(faker.number.int({ min: 1, max: 3 }))
		.values()
		.value();

	const invoiceDate = faker.date.between({
		from: faker.date.past({ years: 0.3 }),
		to: new Date()
	});
	invoice.invoiceDate = moment(invoiceDate).startOf('day').toDate();

	const dueDate = faker.date.between({
		from: new Date(),
		to: faker.date.future({ years: 0.3 })
	});
	invoice.dueDate = moment(dueDate).startOf('day').toDate();

	if (organizationContacts.length) {
		invoice.organizationContactId = faker.helpers.arrayElement(organizationContacts).id;
	}
	invoice.sentTo = organization.id;
	invoice.fromOrganization = organization;
	invoice.toContact = faker.helpers.arrayElement(organizationContacts);
	invoice.currency = organization.currency;
	invoice.discountValue = faker.number.int({ min: 1, max: 10 });
	invoice.paid = faker.datatype.boolean();
	invoice.tax = faker.number.int({ min: 1, max: 10 });
	invoice.tax2 = faker.number.int({ min: 1, max: 10 });
	invoice.terms = 'Term and Setting Applied';
	invoice.isEstimate = faker.datatype.boolean();

	if (invoice.isEstimate) {
		invoice.isAccepted = faker.datatype.boolean();
		invoice.status = faker.helpers.arrayElement(Object.values(EstimateStatusTypesEnum));
	} else {
		invoice.status = faker.helpers.arrayElement(Object.values(InvoiceStatusTypesEnum));
	}

	invoice.discountType = faker.helpers.arrayElement(Object.values(DiscountTaxTypeEnum));
	invoice.taxType = faker.helpers.arrayElement(Object.values(DiscountTaxTypeEnum));
	invoice.tax2Type = faker.helpers.arrayElement(Object.values(DiscountTaxTypeEnum));
	invoice.invoiceType = faker.helpers.arrayElement(Object.values(InvoiceTypeEnum));

	invoice.organization = organization;
	invoice.tenant = tenant;
	invoice.isArchived = false;
	invoice.historyRecords = await generateInvoiceHistory(
		dataSource,
		tenant,
		organization,
		invoice
	);
	return invoice;
};

/**
* Updates invoice estimate records history
* @param dataSource
* @param tenant
* @param organization
* @param invoice
*/
const generateInvoiceHistory = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	invoice: IInvoice
): Promise<IInvoiceEstimateHistory[]> => {
	const historyRecords: IInvoiceEstimateHistory[] = [];
	const { id: tenantId } = tenant;
	const users = await dataSource.manager.findBy(User, {
		tenantId
	});

	historyRecords.push(
		new InvoiceEstimateHistory({
			user: faker.helpers.arrayElement(users),
			action: invoice.isEstimate ? 'Estimated Added' : 'Invoice Added',
			tenant,
			organization
		})
	);

	for (let i = 0; i < faker.number.int({
		min: 2,
		max: randomSeedConfig.numberOfInvoiceHistoryPerInvoice
	}); i++) {
		historyRecords.push(
			new InvoiceEstimateHistory({
				user: faker.helpers.arrayElement(users),
				action: faker.person.jobTitle(),
				tenant,
				organization
			})
		);
	}
	return historyRecords;
}
