import { Connection } from 'typeorm';
import { Invoice } from './invoice.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Tag } from '../tags/tag.entity';
import {
	CurrenciesEnum,
	DiscountTaxTypeEnum,
	InvoiceTypeEnum
} from '@gauzy/models';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';

export const createRandomInvoice = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	noOfInvoicePerOrganization: number
) => {
	let invoices: Invoice[] = [];
	let invoiceItems: InvoiceItem[] = await connection.manager.find(
		InvoiceItem
	);
	for (const tenant of tenants) {
		let organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const tags = await connection.manager.find(Tag, {
				where: [{ organization: organization }]
			});
			for (let i = 0; i < noOfInvoicePerOrganization; i++) {
				let invoice = new Invoice();
				// let invoiceItem = faker.random.arrayElement(invoiceItems);
				invoice.tags = [faker.random.arrayElement(tags)];
				invoice.invoiceDate = faker.date.past(0.2);
				invoice.invoiceNumber = faker.random.number({
					min: 1,
					max: 9999999
				});
				invoice.dueDate = faker.date.recent(50);
				invoice.currency = faker.random.arrayElement(
					Object.values(CurrenciesEnum)
				);
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
				// invoice.clientId
				// invoice.invoiceItems = [faker.random.arrayElement(invoiceItems)];
				invoice.status = 'Active';
				invoices.push(invoice);
			}
		}
	}
	await connection.manager.save(invoices);
};
