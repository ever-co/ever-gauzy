import { DataSource } from 'typeorm';
import * as moment from 'moment';
import { faker } from '@faker-js/faker';
import { chain } from 'underscore';
import { environment as env } from '@gauzy/config';
import { IEmployee, IOrganization, ITenant, PaymentMethodEnum } from '@gauzy/contracts';
import { getRandomElement } from '@gauzy/utils';
import { Payment } from './payment.entity';
import { Invoice, OrganizationProject, Tag, User } from './../core/entities/internal';

/**
 * Generates payments for a list of invoices.
 *
 * @param invoices - The invoices to generate payments for.
 * @param tenant - The tenant associated with the payments.
 * @param organization - The organization associated with the payments.
 * @param tags - The list of tags to assign to payments.
 * @param employees - The list of employees to associate with payments.
 * @param users - The list of users to record payments.
 * @param projects - The list of projects to associate with payments.
 * @returns An array of generated payments.
 */
const generatePaymentsForInvoices = (
	invoices: Invoice[],
	tenant: ITenant,
	organization: IOrganization,
	tags: Tag[],
	employees: IEmployee[],
	users: User[],
	projects: OrganizationProject[]
): Payment[] => {
	const payments: Payment[] = [];

	invoices.forEach((invoice) => {
		const range = faker.date.between({
			from: new Date(),
			to: moment(new Date()).add(1, 'month').toDate()
		});

		const payment = new Payment();
		payment.invoice = invoice;
		payment.paymentDate = moment(range).startOf('day').toDate();
		payment.amount = faker.number.int({ min: 500, max: 5000 });
		payment.note = faker.lorem.sentence();
		payment.currency = organization.currency || env.defaultCurrency;
		payment.paymentMethod = faker.helpers.arrayElement(Object.values(PaymentMethodEnum)) as PaymentMethodEnum;
		payment.overdue = faker.datatype.boolean();
		payment.organization = organization;
		payment.tenant = tenant;
		payment.tags = chain(tags)
			.shuffle()
			.take(faker.number.int({ min: 1, max: 3 }))
			.values()
			.value();
		payment.employee = getRandomElement(employees);
		payment.createdByUser = getRandomElement(users);
		payment.project = getRandomElement(projects);
		payment.organizationContact = invoice.toContact;
		payments.push(payment);
	});

	return payments;
};

/**
 * Creates default payments for a tenant and its organizations.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant for which payments are created.
 * @param employees - The list of employees associated with the tenant.
 * @param organizations - The list of organizations associated with the tenant.
 * @returns A promise that resolves to an array of created payments.
 */
export const createDefaultPayment = async (
	dataSource: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	organizations: IOrganization[]
): Promise<Payment[]> => {
	if (!tenant || !employees.length || !organizations.length) {
		throw new Error('Invalid input: Tenant, employees, and organizations are required.');
	}

	const payments: Payment[] = [];
	const users = await dataSource.manager.findBy(User, { tenantId: tenant.id });

	for await (const organization of organizations) {
		const { id: organizationId } = organization;

		const [projects, tags, invoices] = await Promise.all([
			dataSource.manager.findBy(OrganizationProject, { tenantId: tenant.id, organizationId }),
			dataSource.manager.findBy(Tag, { tenantId: tenant.id, organizationId }),
			dataSource.manager.find(Invoice, {
				where: { tenantId: tenant.id, organizationId, isEstimate: false },
				relations: { toContact: true }
			})
		]);

		const organizationPayments = generatePaymentsForInvoices(
			invoices,
			tenant,
			organization,
			tags,
			employees,
			users,
			projects
		);

		payments.push(...organizationPayments);
	}

	await dataSource.manager.save(payments, { chunk: 100 });
	return payments;
};

/**
 * Creates random payments for multiple tenants and their organizations.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenants - The list of tenants for which payments are created.
 * @param tenantOrganizationsMap - A map of tenants and their organizations.
 * @param organizationEmployeesMap - A map of organizations and their employees.
 * @returns A promise that resolves to an array of created payments.
 */
export const createRandomPayment = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<Payment[]> => {
	if (!tenantOrganizationsMap) {
		console.warn('Warning: tenantOrganizationsMap not found, payments will not be created.');
		return [];
	}

	const allPayments: Payment[] = [];

	for await (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const tenantOrgs = tenantOrganizationsMap.get(tenant) || [];
		const users = await dataSource.manager.findBy(User, { tenantId });

		for await (const organization of tenantOrgs) {
			const tenantEmployees = organizationEmployeesMap.get(organization) || [];
			const { id: organizationId } = organization;

			const [projects, tags, invoices] = await Promise.all([
				dataSource.manager.findBy(OrganizationProject, { tenantId, organizationId }),
				dataSource.manager.findBy(Tag, { tenantId, organizationId }),
				dataSource.manager.find(Invoice, {
					where: { tenantId: tenant.id, organizationId, isEstimate: false },
					relations: { toContact: true }
				})
			]);

			const organizationPayments = generatePaymentsForInvoices(
				invoices,
				tenant,
				organization,
				tags,
				tenantEmployees,
				users,
				projects
			);

			allPayments.push(...organizationPayments);
		}
	}

	await dataSource.manager.save(allPayments, { chunk: 100 });
	return allPayments;
};
