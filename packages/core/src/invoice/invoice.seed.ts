import { DataSource } from 'typeorm';
import { Invoice } from './invoice.entity';
import { faker } from '@ever-co/faker';
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
	const { id: tenantId } = tenant;
	const invoices: IInvoice[] = [];
	for (const organization of organizations) {
		const { id: organizationId } = organization;
		const tags = await dataSource.manager.findBy(Tag, {
			organizationId
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
		for (const organization of organizations) {
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
	invoice.tags = chain(tags)
		.shuffle()
		.take(faker.datatype.number({ min: 1, max: 3 }))
		.values()
		.value();
	invoice.invoiceNumber = faker.datatype.number({ min: 111111111111, max: 999999999999 });

	invoice.invoiceDate = moment(
		faker.date.between(
			new Date(),
			faker.date.past(0.3)
		)
	)
	.startOf('day')
	.toDate();
	invoice.dueDate = moment(
		faker.date.between(
			new Date(),
			faker.date.future(0.3)
		)
	)
	.startOf('day')
	.toDate();

	if (organizationContacts.length) {
		invoice.organizationContactId = faker.random.arrayElement(organizationContacts).id;
	}

	invoice.sentTo = organization.id;
	invoice.fromOrganization = organization;
	invoice.toContact = faker.random.arrayElement(organizationContacts);
	invoice.currency = organization.currency;
	invoice.discountValue = faker.datatype.number({ min: 1, max: 10 });
	invoice.paid = faker.datatype.boolean();
	invoice.tax = faker.datatype.number({ min: 1, max: 10 });
	invoice.tax2 = faker.datatype.number({ min: 1, max: 10 });
	invoice.terms = 'Term and Setting Applied';
	invoice.isEstimate = faker.datatype.boolean();

	if (invoice.isEstimate) {
		invoice.isAccepted = faker.datatype.boolean();
		invoice.status = faker.random.arrayElement(Object.values(EstimateStatusTypesEnum));
	} else {
		invoice.status = faker.random.arrayElement(Object.values(InvoiceStatusTypesEnum));
	}

	invoice.discountType = faker.random.arrayElement(Object.values(DiscountTaxTypeEnum));
	invoice.taxType = faker.random.arrayElement(Object.values(DiscountTaxTypeEnum));
	invoice.tax2Type = faker.random.arrayElement(Object.values(DiscountTaxTypeEnum));
	invoice.invoiceType = faker.random.arrayElement(Object.values(InvoiceTypeEnum));

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
			user: faker.random.arrayElement(users),
			action: invoice.isEstimate ? 'Estimated Added' : 'Invoice Added',
			tenant,
			organization
		})
	);

	for (let i = 0; i < faker.datatype.number({
		min: 2,
		max: randomSeedConfig.numberOfInvoiceHistoryPerInvoice
	}); i++) {
		historyRecords.push(
			new InvoiceEstimateHistory({
				user: faker.random.arrayElement(users),
				action: faker.name.jobTitle(),
				tenant,
				organization
			})
		);
	}
	return historyRecords;
}
