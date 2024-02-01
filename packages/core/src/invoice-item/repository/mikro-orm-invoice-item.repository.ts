import { EntityRepository } from '@mikro-orm/core';
import { InvoiceItem } from '../invoice-item.entity';

export class MikroOrmInvoiceItemRepository extends EntityRepository<InvoiceItem> { }