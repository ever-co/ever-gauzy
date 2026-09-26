import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentProvider } from '../payment-provider.entity';

/**
 * TypeORM repository of PaymentProvider. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PaymentProvider>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPaymentProviderRepository extends Repository<PaymentProvider> {
	constructor(@InjectRepository(PaymentProvider) readonly repository: Repository<PaymentProvider>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
