import { EntityRepository } from '@mikro-orm/core';
import { InvoiceEstimateHistory } from '../invoice-estimate-history.entity';

export class MikroOrmInvoiceEstimateHistoryRepository extends EntityRepository<InvoiceEstimateHistory> { }