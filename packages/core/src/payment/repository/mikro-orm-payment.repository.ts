import { EntityRepository } from '@mikro-orm/knex';
import { Payment } from '../payment.entity';

export class MikroOrmPaymentRepository extends EntityRepository<Payment> { }
