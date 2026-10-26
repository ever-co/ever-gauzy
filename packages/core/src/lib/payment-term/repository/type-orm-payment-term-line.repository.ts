import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTermLine } from '../payment-term-line.entity';

@Injectable()
export class TypeOrmPaymentTermLineRepository extends Repository<PaymentTermLine> {
	constructor(@InjectRepository(PaymentTermLine) readonly repository: Repository<PaymentTermLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
