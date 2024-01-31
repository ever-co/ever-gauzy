import { Repository } from 'typeorm';
import { InvoiceEstimateHistory } from '../invoice-estimate-history.entity';

export class TypeOrmInvoiceEstimateHistoryRepository extends Repository<InvoiceEstimateHistory> { }