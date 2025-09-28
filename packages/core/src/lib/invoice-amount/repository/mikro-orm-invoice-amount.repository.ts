import { InvoiceAmount } from '../invoice-amount.entity';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';

export class MikroOrmInvoiceAmountRepository extends MikroOrmBaseEntityRepository<InvoiceAmount> {}
