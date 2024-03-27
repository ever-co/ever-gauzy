import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Payment } from '../payment.entity';

export class MikroOrmPaymentRepository extends MikroOrmBaseEntityRepository<Payment> { }
