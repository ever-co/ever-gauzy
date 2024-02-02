import { EntityRepository } from '@mikro-orm/core';
import { Payment } from '../payment.entity';

export class MikroOrmPaymentRepository extends EntityRepository<Payment> { }