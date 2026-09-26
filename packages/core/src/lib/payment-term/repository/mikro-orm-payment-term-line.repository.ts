import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PaymentTermLine } from '../payment-term-line.entity';

export class MikroOrmPaymentTermLineRepository extends MikroOrmBaseEntityRepository<PaymentTermLine> {}
