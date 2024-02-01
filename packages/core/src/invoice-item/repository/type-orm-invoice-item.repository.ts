import { Repository } from 'typeorm';
import { InvoiceItem } from '../invoice-item.entity';

export class TypeOrmInvoiceItemRepository extends Repository<InvoiceItem> { }