import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { InvoiceItem } from '../invoice-item.entity';

export class MikroOrmInvoiceItemRepository extends MikroOrmBaseEntityRepository<InvoiceItem> { }
