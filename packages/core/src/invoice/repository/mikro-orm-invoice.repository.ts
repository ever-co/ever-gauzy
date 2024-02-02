import { EntityRepository } from '@mikro-orm/core';
import { Invoice } from '../invoice.entity';

export class MikroOrmInvoiceRepository extends EntityRepository<Invoice> { }