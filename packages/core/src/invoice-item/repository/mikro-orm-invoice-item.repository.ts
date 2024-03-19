import { EntityRepository } from '@mikro-orm/knex';
import { InvoiceItem } from '../invoice-item.entity';

export class MikroOrmInvoiceItemRepository extends EntityRepository<InvoiceItem> { }
