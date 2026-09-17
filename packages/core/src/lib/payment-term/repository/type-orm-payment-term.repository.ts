import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTerm } from '../payment-term.entity';

@Injectable()
export class TypeOrmPaymentTermRepository extends Repository<PaymentTerm> {
	constructor(@InjectRepository(PaymentTerm) readonly repository: Repository<PaymentTerm>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
