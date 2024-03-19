import { EntityRepository } from '@mikro-orm/knex';
import { Invoice } from '../invoice.entity';

export class MikroOrmInvoiceRepository extends EntityRepository<Invoice> { }
