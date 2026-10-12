import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PaymentTerm } from '../payment-term.entity';

export class MikroOrmPaymentTermRepository extends MikroOrmBaseEntityRepository<PaymentTerm> {}
