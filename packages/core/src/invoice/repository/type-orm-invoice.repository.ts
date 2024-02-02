import { Repository } from 'typeorm';
import { Invoice } from '../invoice.entity';

export class TypeOrmInvoiceRepository extends Repository<Invoice> { }