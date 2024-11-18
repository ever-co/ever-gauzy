import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant, PaymentMethodEnum } from '@gauzy/contracts';
import { Payment } from './payment.entity';
import { faker } from '@faker-js/faker';
import moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Invoice, OrganizationProject, Tag, User } from './../core/entities/internal';
import * as _ from 'underscore';

export const createDefaultPayment = async (
	dataSource: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	organizations: IOrganization[]
): Promise<Payment[]> => {
	const payments: Payment[] = [];
	const { id: tenantId } = tenant;
	const users = await dataSource.manager.findBy(User, {
		tenantId
	});
	for (const organization of organizations) {
		const { id: organizationId } = organization;
		const projects = await dataSource.manager.findBy(OrganizationProject, {
			tenantId,
			organizationId
		});
		const tags = await dataSource.manager.findBy(Tag, {
			tenantId,
			organizationId
		});
		const invoices = await dataSource.manager.find(Invoice, {
			where: {
				tenantId,
				organizationId,
				isEstimate: false
			},
			relations: ['toContact']
		});
		for (const invoice of invoices) {
			const payment = new Payment();
			payment.invoice = invoice;
			payment.paymentDate = moment(
				faker.date.between({
					from: new Date(),
					to: moment(new Date()).add(1, 'month').toDate()
				})
			)
				.startOf('day')
				.toDate();
			payment.amount = faker.number.int({
				min: 500,
				max: 5000
			});
			payment.note = faker.person.jobDescriptor();
			payment.currency = organization.currency || env.defaultCurrency;
			payment.paymentMethod = faker.helpers.arrayElement(
				Object.keys(PaymentMethodEnum)
			) as PaymentMethodEnum;
			payment.overdue = faker.datatype.boolean();
			payment.organization = organization;
			payment.tenant = tenant;
			payment.tags = _.chain(tags)
				.shuffle()
				.take(faker.number.int({ min: 1, max: 3 }))
				.values()
				.value();
			payment.organizationContact = invoice.toContact;
			payment.employeeId = faker.helpers.arrayElement(employees).id;
			payment.recordedBy = faker.helpers.arrayElement(users);

			const project = faker.helpers.arrayElement(projects);
			if (project) {
				payment.projectId = project.id;
			}
			payments.push(payment);
		}
	}
	await dataSource.manager.save(payments);
	return payments;
};

export const createRandomPayment = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<Payment[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Payment  will not be created'
		);
		return;
	}

	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		const users = await dataSource.manager.findBy(User, {
			tenantId
		});
		const payments1: Payment[] = [];
		const payments2: Payment[] = [];
		for (const organization of tenantOrgs) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			const { id: organizationId } = organization;
			const projects = await dataSource.manager.findBy(OrganizationProject, {
				organizationId,
				tenantId
			});
			const tags = await dataSource.manager.findBy(Tag, {
				organizationId,
				tenantId
			});
			const invoices = await dataSource.manager.find(Invoice, {
				where: {
					organizationId,
					tenantId,
					isEstimate: false
				},
				relations: ['toContact']
			});
			let count = 0;
			for (const invoice of invoices) {
				const payment = new Payment();
				payment.invoice = invoice;
				payment.paymentDate = moment(
					faker.date.between({
						from: new Date(),
						to: moment(new Date()).add(1, 'month').toDate()
					})
				)
					.startOf('day')
					.toDate();
				payment.amount = faker.number.int({
					min: 500,
					max: 5000
				});
				payment.note = faker.person.jobDescriptor();
				payment.currency = organization.currency || env.defaultCurrency;
				payment.paymentMethod = faker.helpers.arrayElement(
					Object.keys(PaymentMethodEnum)
				) as PaymentMethodEnum;
				payment.overdue = faker.datatype.boolean();
				payment.organization = organization;
				payment.tenant = tenant;
				payment.tags = _.chain(tags)
					.shuffle()
					.take(faker.number.int({ min: 1, max: 3 }))
					.values()
					.value();
				payment.organizationContact = invoice.toContact;
				payment.employeeId = faker.helpers.arrayElement(tenantEmployees).id;
				payment.recordedBy = faker.helpers.arrayElement(users);

				const project = faker.helpers.arrayElement(projects);
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
		await dataSource.manager.save(payments1);
		await dataSource.manager.save(payments2);
	}
};
