import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Invoice } from '../invoice.entity';

export class MikroOrmInvoiceRepository extends MikroOrmBaseEntityRepository<Invoice> { }
