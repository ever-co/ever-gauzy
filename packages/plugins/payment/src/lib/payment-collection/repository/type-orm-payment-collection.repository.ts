import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentCollection } from '../payment-collection.entity';

/**
 * TypeORM repository of PaymentCollection. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PaymentCollection>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPaymentCollectionRepository extends Repository<PaymentCollection> {
	constructor(@InjectRepository(PaymentCollection) readonly repository: Repository<PaymentCollection>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
