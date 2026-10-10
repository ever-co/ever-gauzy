import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSession } from '../payment-session.entity';

/**
 * TypeORM repository of PaymentSession. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PaymentSession>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPaymentSessionRepository extends Repository<PaymentSession> {
	constructor(@InjectRepository(PaymentSession) readonly repository: Repository<PaymentSession>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
