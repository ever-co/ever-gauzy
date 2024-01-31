import { Repository } from 'typeorm';
import { Payment } from '../payment.entity';

export class TypeOrmPaymentRepository extends Repository<Payment> { }