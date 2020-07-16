import { Connection } from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import * as faker from 'faker';
import { Task } from '../tasks/task.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Invoice } from '../invoice/invoice.entity';

let invoiceItems: InvoiceItem[] = [];
export const createRandomInvoiceItem = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantEmployeeMap: Map<Tenant, Employee[]>
) => {
	let tasks: Task[] = await connection.manager.find(Task);
	let invoices: Invoice[] = await connection.manager.find(Invoice);
	for (const tenant of tenants) {
		let organizations = tenantOrganizationsMap.get(tenant);
		let employees = tenantEmployeeMap.get(tenant);
		for (const organization of organizations) {
			let projects = await connection.manager.find(OrganizationProjects, {
				where: [{ organizationId: organization.id }]
			});
			invoiceItemForTasks(tasks, employees, invoices);
			invoiceItemForProjects(projects, employees, invoices);
			await connection.manager.save(invoiceItems);
		}
	}
};

function invoiceItemForTasks(
	tasks: Task[],
	employees: Employee[],
	invoices: Invoice[]
) {
	for (let i = 0; i < 20; i++) {
		let invoiceItem = new InvoiceItem();
		invoiceItem.name = faker.company.companyName();
		invoiceItem.description = faker.random.words();
		invoiceItem.price = faker.random.number({ min: 1000, max: 10000 });
		invoiceItem.quantity = faker.random.number({ min: 10, max: 150 });
		invoiceItem.totalValue = faker.random.number({
			min: 10000,
			max: 100000
		});
		invoiceItem.invoiceId = faker.random.arrayElement(invoices).id;
		invoiceItem.task = faker.random.arrayElement(tasks);
		invoiceItem.employee = faker.random.arrayElement(employees);
		invoiceItem.applyDiscount = faker.random.boolean();
		invoiceItem.applyTax = faker.random.boolean();
		invoiceItems.push(invoiceItem);
	}
}

function invoiceItemForProjects(
	project: OrganizationProjects[],
	employees: Employee[],
	invoices: Invoice[]
) {
	for (let i = 0; i < 20; i++) {
		let invoiceItem = new InvoiceItem();
		invoiceItem.name = faker.company.companyName();
		invoiceItem.description = faker.random.words();
		invoiceItem.price = faker.random.number({ min: 1000, max: 10000 });
		invoiceItem.quantity = faker.random.number({ min: 10, max: 150 });
		invoiceItem.totalValue = faker.random.number({
			min: 10000,
			max: 100000
		});
		invoiceItem.invoiceId = faker.random.arrayElement(invoices).id;
		invoiceItem.project = faker.random.arrayElement(project);
		invoiceItem.employee = faker.random.arrayElement(employees);
		invoiceItem.applyDiscount = faker.random.boolean();
		invoiceItem.applyTax = faker.random.boolean();
		invoiceItems.push(invoiceItem);
	}
}
