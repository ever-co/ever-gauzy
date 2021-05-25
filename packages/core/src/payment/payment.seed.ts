import { Connection } from 'typeorm';
import { IEmployee, IOrganization, ITenant, PaymentMethodEnum } from '@gauzy/contracts';
import { Payment } from './payment.entity';
import * as faker from 'faker';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Invoice, User } from './../core/entities/internal';

export const createDefaultPayment = async (
	connection: Connection,
	tenant: ITenant,
	employees: IEmployee[],
	organizations: IOrganization[]
): Promise<Payment[]> => {
	const payments: Payment[] = [];
	const users = await connection.manager.find(User, {
		where: { 
			tenant 
		}
	});
	for (const organization of organizations) {
		const invoices = await connection.manager.find(Invoice, {
			where: { 
				organization,
				tenant
			}
		});
		for (const invoice of invoices) {
			const payment = new Payment();
			payment.invoiceId = invoice.id;
			payment.paymentDate = faker.date.between(
				new Date(),
				moment(new Date()).add(1, 'month').toDate()
			);
			payment.amount = faker.datatype.number({
				min: 1000,
				max: 100000
			});
			payment.note = faker.name.jobDescriptor();
			payment.currency = organization.currency || env.defaultCurrency;
			payment.paymentMethod = faker.random.arrayElement(
				Object.keys(PaymentMethodEnum)
			);
			payment.overdue = faker.datatype.boolean();
			payment.organization = organization;
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
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
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
			where: { 
				tenant: tenant 
			}
		});
		const payments1: Payment[] = [];
		const payments2: Payment[] = [];
		for (const organization of tenantOrgs) {
			const invoices = await connection.manager.find(Invoice, {
				where: { 
					organization,
					tenant
				}
			});
			let count = 0;
			for (const invoice of invoices) {
				const payment = new Payment();
				payment.invoice = invoice;
				payment.paymentDate = faker.date.between(
					new Date(),
					faker.date.recent()
				);
				payment.amount = faker.datatype.number({
					min: 1000,
					max: 100000
				});
				payment.note = faker.name.jobDescriptor();
				payment.currency = organization.currency || env.defaultCurrency;
				payment.paymentMethod = faker.random.arrayElement(
					Object.keys(PaymentMethodEnum)
				);
				payment.overdue = faker.datatype.boolean();
				payment.organization = organization;
				payment.tenant = tenant;
				payment.tags = invoice.tags;
				payment.employeeId = faker.random.arrayElement(tenantEmployees).id;
				payment.recordedBy = faker.random.arrayElement(users);
				
				if (count % 2 === 0) {
					payments1.push(payment);
				} else {
					payments2.push(payment);
				}
				count++;
			}
		}
		await connection.manager.save(payments1);
		await connection.manager.save(payments2);
	}
};
