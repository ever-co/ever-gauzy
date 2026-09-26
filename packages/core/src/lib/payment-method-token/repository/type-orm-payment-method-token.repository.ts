import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethodToken } from '../payment-method-token.entity';

@Injectable()
export class TypeOrmPaymentMethodTokenRepository extends Repository<PaymentMethodToken> {
	constructor(@InjectRepository(PaymentMethodToken) readonly repository: Repository<PaymentMethodToken>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
