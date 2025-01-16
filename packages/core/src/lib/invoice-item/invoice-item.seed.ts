import { DataSource } from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { faker } from '@faker-js/faker';
import {
	IInvoiceItem,
	InvoiceTypeEnum,
	IOrganization,
	ITenant
} from '@gauzy/contracts';
import { getRandomElement } from '@gauzy/utils';
import {
	Employee,
	Expense,
	Invoice,
	OrganizationProject,
	Product,
	Task
} from './../core/entities/internal';

/**
 * Generates and saves invoice items for the specified tenant and organizations.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant for which invoice items are being created.
 * @param organizations - The organizations to associate with the invoice items.
 * @param numberOfInvoiceItemPerInvoice - The number of invoice items per invoice.
 */
const generateAndSaveInvoiceItems = async (
    dataSource: DataSource,
    tenant: ITenant,
    organizations: IOrganization[],
    numberOfInvoiceItemPerInvoice: number
): Promise<void> => {
    for await (const organization of organizations) {
        const invoiceItems = await generateInvoiceItemsForType(
            dataSource,
            tenant,
            organization,
            numberOfInvoiceItemPerInvoice
        );
        await dataSource.manager.save(invoiceItems);
    }
};

/**
 * Creates default invoice items for a tenant and its organizations.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant for which default invoice items are being created.
 * @param organizations - The organizations to associate with the invoice items.
 * @param numberOfInvoiceItemPerInvoice - The number of invoice items per invoice.
 */
export const createDefaultInvoiceItem = async (
    dataSource: DataSource,
    tenant: ITenant,
    organizations: IOrganization[],
    numberOfInvoiceItemPerInvoice: number
): Promise<void> => {
    if (!tenant || !organizations || organizations.length === 0) {
        throw new Error('Invalid tenant or organizations provided for default invoice item creation.');
    }

    await generateAndSaveInvoiceItems(dataSource, tenant, organizations, numberOfInvoiceItemPerInvoice);
};

/**
 * Creates random invoice items for multiple tenants and their organizations.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenants - The tenants for which random invoice items are being created.
 * @param tenantOrganizationsMap - A map of tenants to their respective organizations.
 * @param numberOfInvoiceItemPerInvoice - The number of invoice items per invoice.
 * @returns A promise that resolves when all invoice items are created and saved.
 */
export const createRandomInvoiceItem = async (
    dataSource: DataSource,
    tenants: ITenant[],
    tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
    numberOfInvoiceItemPerInvoice: number
): Promise<void> => {
    if (!tenants || tenants.length === 0) {
        throw new Error('Tenants list cannot be empty.');
    }

    if (!tenantOrganizationsMap) {
        throw new Error('Tenant organizations map is required.');
    }

    for await (const tenant of tenants) {
        const organizations = tenantOrganizationsMap.get(tenant);

        if (!organizations || organizations.length === 0) {
            console.warn(`No organizations found for tenant: ${tenant.name}`);
            continue;
        }

        await generateAndSaveInvoiceItems(dataSource, tenant, organizations, numberOfInvoiceItemPerInvoice);
    }
};

/**
 * Generates invoice items based on the invoice type for a given tenant and organization.
 *
 * @param dataSource - The TypeORM data source for database operations.
 * @param tenant - The tenant for which the invoice items are generated.
 * @param organization - The organization to associate with the invoice items.
 * @param numberOfInvoiceItemPerInvoice - The number of invoice items to generate per invoice.
 * @returns A promise that resolves to an array of generated invoice items.
 */
const generateInvoiceItemsForType = async (
    dataSource: DataSource,
    tenant: ITenant,
    organization: IOrganization,
    numberOfInvoiceItemPerInvoice: number
): Promise<IInvoiceItem[]> => {
    const where = { tenantId: tenant.id, organizationId: organization.id };

    // Fetch related entities in parallel
    const [employees, projects, tasks, products, expenses, invoices] = await Promise.all([
        dataSource.manager.find(Employee, { where }),
        dataSource.manager.find(OrganizationProject, { where }),
        dataSource.manager.find(Task, { where }),
        dataSource.manager.find(Product, { where }),
        dataSource.manager.find(Expense, { where }),
        dataSource.manager.find(Invoice, { where })
    ]);

    const invoiceItems: IInvoiceItem[] = [];

    for (const invoice of invoices) {
        let totalValue = 0;

        for (let i = 0; i < faker.number.int({ min: 1, max: numberOfInvoiceItemPerInvoice }); i++) {
            const invoiceItem = new InvoiceItem();
            invoiceItem.description = faker.lorem.words();
            invoiceItem.price = faker.number.int({ min: 10, max: 50 });
            invoiceItem.quantity = faker.number.int({ min: 10, max: 20 });
            invoiceItem.totalValue = invoiceItem.price * invoiceItem.quantity;
            invoiceItem.invoice = invoice;

           // Assign related entity based on the invoice type
			switch (invoice.invoiceType) {
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					invoiceItem.project = getRandomElement(projects);
					break;

				case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
					invoiceItem.employee = getRandomElement(employees);
					break;

				case InvoiceTypeEnum.BY_TASK_HOURS:
					invoiceItem.task = getRandomElement(tasks);
					break;

				case InvoiceTypeEnum.BY_PRODUCTS:
					invoiceItem.product = getRandomElement(products);
					break;

				case InvoiceTypeEnum.BY_EXPENSES:
					invoiceItem.expense = getRandomElement(expenses);
					break;
			}

            invoiceItem.applyDiscount = faker.datatype.boolean();
            invoiceItem.applyTax = faker.datatype.boolean();
            invoiceItem.tenant = tenant;
            invoiceItem.organization = organization;
            totalValue += invoiceItem.totalValue;
            invoiceItems.push(invoiceItem);
        }

        // Update the invoice total value
        invoice.totalValue = totalValue;
        await dataSource.manager.save(invoice);
    }

    return invoiceItems;
};
