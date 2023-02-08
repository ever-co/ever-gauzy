import { DataSource } from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { faker } from '@faker-js/faker';
import {
	IEmployee,
	IExpense,
	IInvoice,
	IInvoiceItem,
	InvoiceTypeEnum,
	IOrganization,
	IOrganizationProject,
	ITask,
	ITenant
} from '@gauzy/contracts';
import {
	Employee,
	Expense,
	Invoice,
	OrganizationProject,
	Product,
	Task
} from './../core/entities/internal';


export const createDefaultInvoiceItem = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	numberOfInvoiceItemPerInvoice: number
) => {
	for await (const organization of organizations) {
		const invoiceItems = await invoiceItemForInvoiceType(
			dataSource,
			tenant,
			organization,
			numberOfInvoiceItemPerInvoice
		);
		await dataSource.manager.save(invoiceItems);
	}
};

export const createRandomInvoiceItem = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfInvoiceItemPerInvoice: number
) => {
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const invoiceItems = await invoiceItemForInvoiceType(
				dataSource,
				tenant,
				organization,
				numberOfInvoiceItemPerInvoice
			);
			await dataSource.manager.save(invoiceItems);
		}
	}
};

async function invoiceItemForInvoiceType(
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	numberOfInvoiceItemPerInvoice: number
) {

	const { id: tenantId } = tenant;
	const { id: organizationId } = organization;

	const where = {
		tenantId: tenantId,
		organizationId: organizationId
	};
	const employees: IEmployee[] = await dataSource.manager.find(Employee, { where });
	const projects: IOrganizationProject[] = await dataSource.manager.find(OrganizationProject, { where });
	const tasks: ITask[] = await dataSource.manager.find(Task, { where });
	const products: Product[] = await dataSource.manager.find(Product, { where });
	const expenses: IExpense[] = await dataSource.manager.find(Expense, { where });
	const invoices: IInvoice[] = await dataSource.manager.find(Invoice, { where });

	const invoiceItems: IInvoiceItem[] = [];
	for await (const invoice of invoices) {
		let totalValue = 0;
		for (let i = 0; i < faker.datatype.number({ min: 1, max: numberOfInvoiceItemPerInvoice }); i++) {
			const invoiceItem = new InvoiceItem();
			invoiceItem.description = faker.random.words();
			invoiceItem.price = faker.datatype.number({ min: 10, max: 50 });
			invoiceItem.quantity = faker.datatype.number({ min: 10, max: 20 });
			invoiceItem.totalValue = invoiceItem.price * invoiceItem.quantity;
			invoiceItem.invoice = invoice;

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
			totalValue += invoiceItem.totalValue;
			invoiceItems.push(invoiceItem);
		}
		invoice.totalValue = totalValue;
		await dataSource.manager.save(invoice);
	}
	return invoiceItems;
}
