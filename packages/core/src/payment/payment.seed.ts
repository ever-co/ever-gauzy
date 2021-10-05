import { Connection } from 'typeorm';
import { IEmployee, IOrganization, ITenant, PaymentMethodEnum } from '@gauzy/contracts';
import { Payment } from './payment.entity';
import * as faker from 'faker';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Invoice, OrganizationProject, Tag, User } from './../core/entities/internal';
import * as _ from 'underscore';

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
		const projects = await connection.manager.find(OrganizationProject, {
			where: { 
				organization,
				tenant
			}
		});
		const tags = await connection.manager.find(Tag, {
			where: { 
				organization
			}
		});
		const invoices = await connection.manager.find(Invoice, {
			where: { 
				organization,
				tenant,
				isEstimate: 0
			},
			relations: ['toContact']
		});
		for (const invoice of invoices) {
			const payment = new Payment();
			payment.invoiceId = invoice.id;
			payment.paymentDate = faker.date.between(
				new Date(),
				moment(new Date()).add(1, 'month').toDate()
			);
			payment.amount = faker.datatype.number({
				min: 500,
				max: 5000
			});
			payment.note = faker.name.jobDescriptor();
			payment.currency = organization.currency || env.defaultCurrency;
			payment.paymentMethod = faker.random.arrayElement(Object.keys(PaymentMethodEnum));
			payment.overdue = faker.datatype.boolean();
			payment.organization = organization;
			payment.tenant = tenant;
			payment.tags = _.chain(tags)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 3 }))
					.values()
					.value();
			payment.organizationContact = invoice.toContact;
			payment.employeeId = faker.random.arrayElement(employees).id;
			payment.recordedBy = faker.random.arrayElement(users);

			const project = faker.random.arrayElement(projects);
			if (project) {
				payment.projectId = project.id;
			}
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
				tenant
			}
		});
		const payments1: Payment[] = [];
		const payments2: Payment[] = [];
		for (const organization of tenantOrgs) {
			const projects = await connection.manager.find(OrganizationProject, {
				where: { 
					organization,
					tenant
				}
			});
			const tags = await connection.manager.find(Tag, {
				where: { 
					organization
				}
			});
			const invoices = await connection.manager.find(Invoice, {
				where: { 
					organization,
					tenant,
					isEstimate: 0
				},
				relations: ['toContact']
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
					min: 500,
					max: 5000
				});
				payment.note = faker.name.jobDescriptor();
				payment.currency = organization.currency || env.defaultCurrency;
				payment.paymentMethod = faker.random.arrayElement(
					Object.keys(PaymentMethodEnum)
				);
				payment.overdue = faker.datatype.boolean();
				payment.organization = organization;
				payment.tenant = tenant;
				payment.tags = _.chain(tags)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 3 }))
					.values()
					.value();
				payment.organizationContact = invoice.toContact;
				payment.employeeId = faker.random.arrayElement(tenantEmployees).id;
				payment.recordedBy = faker.random.arrayElement(users);

				const project = faker.random.arrayElement(projects);
				if (project) {
					payment.projectId = project.id;
				}
				
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
