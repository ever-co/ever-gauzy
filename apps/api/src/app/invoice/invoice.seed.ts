import { Connection } from 'typeorm';
import { Invoice } from './invoice.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Tag } from '../tags/tag.entity';
import { DiscountTaxTypeEnum, InvoiceTypeEnum } from '@gauzy/models';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import * as _ from 'underscore';

export const createDefaultInvoice = async (
	connection: Connection,
	tenant: Tenant,
	defaultOrganizations: Organization[],
	noOfInvoicePerOrganization: number
) => {
	const invoices: Invoice[] = [];

	for (const organization of defaultOrganizations) {
		const tags = await connection.manager.find(Tag, {
			where: [{ organization: organization }]
		});
		const organizationContacts = await connection.manager.find(
			OrganizationContact,
			{ where: [{ organizationId: organization.id }] }
		);
		for (let i = 0; i < noOfInvoicePerOrganization; i++) {
			const invoice = new Invoice();

			invoice.tags = _.chain(tags)
				.shuffle()
				.take(faker.random.number({ min: 1, max: 3 }))
				.values()
				.value();
			invoice.invoiceDate = faker.date.past(0.2);
			invoice.invoiceNumber = faker.random.number({
				min: 1,
				max: 9999999
			});
			invoice.dueDate = faker.date.recent(50);
			invoice.organizationContactId = faker.random.arrayElement(
				organizationContacts
			).id;
			invoice.sentTo = organization.id;
			invoice.fromOrganization = organization;
			invoice.toContact = faker.random.arrayElement(organizationContacts);
			invoice.currency = organization.currency;
			invoice.discountValue = faker.random.number({
				min: 1,
				max: 10
			});
			invoice.paid = faker.random.boolean();
			invoice.tax = faker.random.number({ min: 1, max: 10 });
			invoice.tax2 = faker.random.number({ min: 1, max: 10 });
			invoice.terms = 'Term and Setting Applied';
			invoice.isEstimate = faker.random.boolean();
			if (invoice.isEstimate) {
				invoice.isAccepted = faker.random.boolean();
			}
			invoice.discountType = faker.random.arrayElement(
				Object.values(DiscountTaxTypeEnum)
			);
			invoice.taxType = faker.random.arrayElement(
				Object.values(DiscountTaxTypeEnum)
			);
			invoice.tax2Type = faker.random.arrayElement(
				Object.values(DiscountTaxTypeEnum)
			);
			invoice.invoiceType = faker.random.arrayElement(
				Object.values(InvoiceTypeEnum)
			);
			invoice.organizationId = organization.id;
			invoice.status = 'Active';
			invoice.totalValue = faker.random.number(99999);
			invoice.tenant = tenant;
			invoices.push(invoice);
		}
	}

	await connection.manager.save(invoices);
};

export const createRandomInvoice = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	noOfInvoicePerOrganization: number
) => {
	const invoices: Invoice[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const tags = await connection.manager.find(Tag, {
				where: [{ organization: organization }]
			});
			const organizationContacts = await connection.manager.find(
				OrganizationContact,
				{ where: [{ organizationId: organization.id }] }
			);
			for (let i = 0; i < noOfInvoicePerOrganization; i++) {
				const invoice = new Invoice();
				// let invoiceItem = faker.random.arrayElement(invoiceItems);
				invoice.tags = _.chain(tags)
					.shuffle()
					.take(faker.random.number({ min: 1, max: 3 }))
					.values()
					.value();
				invoice.invoiceDate = faker.date.past(0.2);
				invoice.invoiceNumber = faker.random.number({
					min: 1,
					max: 9999999
				});
				invoice.dueDate = faker.date.recent(50);
				invoice.organizationContactId = faker.random.arrayElement(
					organizationContacts
				).id;
				invoice.sentTo = organization.id;
				invoice.fromOrganization = organization;
				invoice.toContact = faker.random.arrayElement(
					organizationContacts
				);
				invoice.currency = organization.currency;
				invoice.discountValue = faker.random.number({
					min: 1,
					max: 10
				});
				invoice.paid = faker.random.boolean();
				invoice.tax = faker.random.number({ min: 1, max: 10 });
				invoice.tax2 = faker.random.number({ min: 1, max: 10 });
				invoice.terms = 'Term and Setting Applied';
				invoice.isEstimate = faker.random.boolean();
				if (invoice.isEstimate) {
					invoice.isAccepted = faker.random.boolean();
				}
				invoice.discountType = faker.random.arrayElement(
					Object.values(DiscountTaxTypeEnum)
				);
				invoice.taxType = faker.random.arrayElement(
					Object.values(DiscountTaxTypeEnum)
				);
				invoice.tax2Type = faker.random.arrayElement(
					Object.values(DiscountTaxTypeEnum)
				);
				invoice.invoiceType = faker.random.arrayElement(
					Object.values(InvoiceTypeEnum)
				);
				invoice.organizationId = organization.id;
				invoice.status = 'Active';
				invoice.totalValue = faker.random.number(99999);
				invoice.tenant = tenant;
				invoices.push(invoice);
			}
		}
	}
	await connection.manager.save(invoices);
};
