import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderLineInvoice } from '../order-line-invoice.entity';

export class MikroOrmOrderLineInvoiceRepository extends MikroOrmBaseEntityRepository<OrderLineInvoice> {}
