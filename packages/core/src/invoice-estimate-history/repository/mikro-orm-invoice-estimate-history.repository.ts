import { EntityRepository } from '@mikro-orm/knex';
import { InvoiceEstimateHistory } from '../invoice-estimate-history.entity';

export class MikroOrmInvoiceEstimateHistoryRepository extends EntityRepository<InvoiceEstimateHistory> { }
