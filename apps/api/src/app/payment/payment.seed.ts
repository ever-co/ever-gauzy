import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import {
  CurrenciesEnum,
  Employee,
  Organization,
  PaymentMethodEnum
} from '@gauzy/models';
import { Payment } from './payment.entity';
import * as faker from 'faker';
import { Invoice } from '../invoice/invoice.entity';
import { Tag } from '../tags/tag.entity';
import { User } from '../user/user.entity';

export const createDefaultPayment = async (
  connection: Connection,
  tenant: Tenant,
  employees: Employee[],
  defaultOrganizations: Organization[]
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
      const tags = await connection.manager.find(Tag, {
        where: [{ organization: tenantOrg }]
      });

      const payment = new Payment();

      payment.invoiceId = invoice.id;
      payment.invoice = invoice;
      payment.organization = tenantOrg;
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
      payment.currency = faker.random.arrayElement(
        Object.keys(CurrenciesEnum)
      );
      payment.paymentMethod = faker.random.arrayElement(
        Object.keys(PaymentMethodEnum)
      );
      payment.overdue = faker.random.boolean();
      payment.tenant = tenant;
      payment.tags = tags;

      // TODO: which user we need to set here, employee?
      payment.userId = faker.random.arrayElement(employees).id;
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
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<Payment[]> => {
  if (!tenantOrganizationsMap) {
    console.warn(
      'Warning: tenantOrganizationsMap not found, Payment  will not be created'
    );
    return;
  }

  const payments: Payment[] = [];

  for (const tenant of tenants) {
    const tenantOrgs = tenantOrganizationsMap.get(tenant);
    const tenantEmployees = tenantEmployeeMap.get(tenant);
    const users = await connection.manager.find(User, {
      where: [{ tenant: tenant.id }]
    });

    for (const tenantOrg of tenantOrgs) {
      const invoices = await connection.manager.find(Invoice, {
        where: [{ organizationId: tenantOrg.id }]
      });
      for (const invoice of invoices) {
        const tags = await connection.manager.find(Tag, {
          where: [{ organization: tenantOrg }]
        });

        const payment = new Payment();

        payment.invoiceId = invoice.id;
        payment.invoice = invoice;
        payment.organization = tenantOrg;
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
        payment.currency = faker.random.arrayElement(
          Object.keys(CurrenciesEnum)
        );
        payment.paymentMethod = faker.random.arrayElement(
          Object.keys(PaymentMethodEnum)
        );
        payment.overdue = faker.random.boolean();
        payment.tenant = tenant;
        payment.tags = tags;

        // TODO: which user we need to set here, employee?
        payment.userId = faker.random.arrayElement(tenantEmployees).id;
        payment.recordedBy = faker.random.arrayElement(users);

        payments.push(payment);
      }
    }
  }
  await connection.manager.save(payments);
};
