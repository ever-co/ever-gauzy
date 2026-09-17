import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerTransaction } from '../seller-transaction.entity';

/**
 * The TypeORM side of the SellerTransaction aggregate.
 *
 * The repository is a provider rather than a bare injection token so that the service can depend on
 * a named class, which is what lets the same service run against either ORM the installation
 * selected.
 */
@Injectable()
export class TypeOrmSellerTransactionRepository extends Repository<SellerTransaction> {
	constructor(@InjectRepository(SellerTransaction) readonly repository: Repository<SellerTransaction>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}