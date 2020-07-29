import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CurrenciesEnum, Employee, ISeedUsers, Organization, PaymentMethodEnum } from '@gauzy/models';
import { Payment } from './payment.entity';
import * as faker from 'faker';
import { Invoice } from '../invoice/invoice.entity';
import { Tag } from '../tags/tag.entity';

export const createRandomPayment = async (
  connection: Connection,
  tenants: Tenant[],
  tenantUsersMap: Map<Tenant, ISeedUsers>,
  tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<Payment[]> => {
  if (!tenantUsersMap) {
    console.warn(
      'Warning: tenantUsersMap not found, Payment  will not be created'
    );
    return;
  }
  if (!tenantOrganizationsMap) {
    console.warn(
      'Warning: tenantOrganizationsMap not found, Payment  will not be created'
    );
    return;
  }

  const payments: Payment[] = [];

  for (const tenant of tenants) {
    const tenantOrgs = tenantOrganizationsMap.get(tenant);
    const { adminUsers, employeeUsers } = tenantUsersMap.get(tenant);

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
        payment.paymentDate = faker.date.between(2019, faker.date.recent());
        payment.amount = faker.random.number({'min':1000,'max':100000});
        payment.note = faker.name.jobDescriptor();
        payment.currency = faker.random.arrayElement(Object.keys(CurrenciesEnum));
        payment.paymentMethod = faker.random.arrayElement(Object.keys(PaymentMethodEnum));
        payment.overdue = faker.random.boolean();
        payment.tenant = tenant;
        payment.tags = tags;

        // TODO: which user we need to set here, employee?
        payment.userId = faker.random.arrayElement(employeeUsers).id;
        payment.recordedBy = faker.random.arrayElement(employeeUsers);

        payments.push(payment);
      }
    }
  }

  await connection.manager.save(payments);
};
