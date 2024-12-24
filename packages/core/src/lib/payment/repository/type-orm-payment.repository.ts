import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payment.entity';

@Injectable()
export class TypeOrmPaymentRepository extends Repository<Payment> {
    constructor(@InjectRepository(Payment) readonly repository: Repository<Payment>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
