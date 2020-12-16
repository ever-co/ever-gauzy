import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee, IOrganization, PaymentMethodEnum } from '@gauzy/models';
import { Payment } from './payment.entity';
import * as faker from 'faker';
import { Invoice } from '../invoice/invoice.entity';
import { Tag } from '../tags/tag.entity';
import { User } from '../user/user.entity';
import * as moment from 'moment';
import { environment as env } from '@env-api/environment';

export const createDefaultPayment = async (
	connection: Connection,
	tenant: Tenant,
	employees: IEmployee[],
	defaultOrganizations: IOrganization[]
): Promise<Payment[]> => {
	const payments: Payment[] = [];

	const users = await connection.manager.find(User, {
		where: [{ tenant: tenant.id }]
	});

	for (const tenantOrg of defaultOrganizations) {
		const invoices = await connection.manager.find(Invoice, {
			where: [{ organizationId: tenantOrg.id }]
		});
		for (const invoice of invoices) {
			const payment = new Payment();

			payment.invoiceId = invoice.id;
			payment.invoice = invoice;
			payment.organization = tenantOrg;
			payment.organizationId = tenantOrg.id;
			payment.paymentDate = faker.date.between(
				new Date(),
				moment(new Date()).add(1, 'month').toDate()
			);
			payment.amount = faker.random.number({
				min: 1000,
				max: 100000
			});
			payment.note = faker.name.jobDescriptor();
			payment.currency = tenantOrg.currency || env.defaultCurrency;
			payment.paymentMethod = faker.random.arrayElement(
				Object.keys(PaymentMethodEnum)
			);
			payment.overdue = faker.random.boolean();
			payment.tenant = tenant;
			payment.tags = invoice.tags;
			payment.employeeId = faker.random.arrayElement(employees).id;
			payment.recordedBy = faker.random.arrayElement(users);

			payments.push(payment);
		}
	}
	await connection.manager.save(payments);
	return payments;
};

export const createRandomPayment = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]>,
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
): Promise<Payment[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Payment  will not be created'
		);
		return;
	}

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		const users = await connection.manager.find(User, {
			where: [{ tenant: tenant.id }]
		});

		for (const tenantOrg of tenantOrgs) {
			const payments1: Payment[] = [];
			const payments2: Payment[] = [];
			const invoices = await connection.manager.find(Invoice, {
				where: { organizationId: tenantOrg.id }
			});
			let count = 0;
			for (const invoice of invoices) {
				const tags = await connection.manager.find(Tag, {
					where: [{ organization: tenantOrg }]
				});
				const payment = new Payment();
				payment.invoice = invoice;
				payment.organizationId = tenantOrg.id;
				payment.paymentDate = faker.date.between(
					2019,
					faker.date.recent()
				);
				payment.amount = faker.random.number({
					min: 1000,
					max: 100000
				});
				payment.note = faker.name.jobDescriptor();
				payment.currency = tenantOrg.currency || env.defaultCurrency;
				payment.paymentMethod = faker.random.arrayElement(
					Object.keys(PaymentMethodEnum)
				);
				payment.overdue = faker.random.boolean();
				payment.tenant = tenant;
				payment.tags = tags;
				payment.employeeId = faker.random.arrayElement(
					tenantEmployees
				).id;
				payment.recordedBy = faker.random.arrayElement(users);
				if (count % 2 === 0) {
					payments1.push(payment);
				} else {
					payments2.push(payment);
				}
				count++;
			}
			await connection.manager.save(payments1);
			await connection.manager.save(payments2);
		}
	}
};
