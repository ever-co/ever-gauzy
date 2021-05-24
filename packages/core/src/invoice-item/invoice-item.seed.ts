import { Connection } from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import * as faker from 'faker';
import { InvoiceTypeEnum, IOrganization, ITenant } from '@gauzy/contracts';
import { Employee, Expense, Invoice, OrganizationProject, Product, Task } from './../core/entities/internal';

const invoiceItems: InvoiceItem[] = [];

export const createDefaultInvoiceItem = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[],
	numberOfInvoiceItemPerInvoice: number
) => {
	for (const organization of organizations) {
		await invoiceItemForInvoiceType(
			connection,
			tenant,
			organization,
			numberOfInvoiceItemPerInvoice
		);
	}
	await connection.manager.save(invoiceItems);
};

export const createRandomInvoiceItem = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfInvoiceItemPerInvoice: number
) => {
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			await invoiceItemForInvoiceType(
				connection,
				tenant,
				organization,
				numberOfInvoiceItemPerInvoice
			);
		}
	}
	await connection.manager.save(invoiceItems);
};

async function invoiceItemForInvoiceType(
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization,
	numberOfInvoiceItemPerInvoice: number
) {
	const where = {
		organizationId: organization.id,
		tenantId: tenant.id
	};
	const invoices: Invoice[] = await connection.manager.find(Invoice, {
		where
	});
	const employees: Employee[] = await connection.manager.find(Employee, {
		where
	});
	const tasks: Task[] = await connection.manager.find(Task, { where });
	const expenses: Expense[] = await connection.manager.find(Expense, {
		where
	});
	const projects: OrganizationProject[] = await connection.manager.find(
		OrganizationProject,
		{ where }
	);
	const products: Product[] = await connection.manager.find(Product, {
		where
	});

	for (let i = 0; i < numberOfInvoiceItemPerInvoice; i++) {
		const invoiceItem = new InvoiceItem();
		invoiceItem.name = faker.company.companyName();
		invoiceItem.description = faker.random.words();
		invoiceItem.price = faker.datatype.number({ min: 1000, max: 10000 });
		invoiceItem.quantity = faker.datatype.number({ min: 10, max: 150 });
		invoiceItem.totalValue = faker.datatype.number({
			min: 10000,
			max: 100000
		});

		const invoice = faker.random.arrayElement(invoices);
		invoiceItem.invoiceId = invoice.id;

		switch (invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				invoiceItem.employee = faker.random.arrayElement(employees);
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				invoiceItem.project = faker.random.arrayElement(projects);
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				invoiceItem.task = faker.random.arrayElement(tasks);
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				invoiceItem.product = faker.random.arrayElement(products);
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				invoiceItem.expense = faker.random.arrayElement(expenses);
				break;
		}

		invoiceItem.applyDiscount = faker.datatype.boolean();
		invoiceItem.applyTax = faker.datatype.boolean();
		invoiceItem.tenant = tenant;
		invoiceItem.organization = organization;

		invoiceItems.push(invoiceItem);
	}
}
