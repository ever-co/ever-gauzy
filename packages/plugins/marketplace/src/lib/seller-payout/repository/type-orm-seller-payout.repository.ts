import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerPayout } from '../seller-payout.entity';

/**
 * The TypeORM side of the SellerPayout aggregate.
 *
 * The repository is a provider rather than a bare injection token so that the service can depend on
 * a named class, which is what lets the same service run against either ORM the installation
 * selected.
 */
@Injectable()
export class TypeOrmSellerPayoutRepository extends Repository<SellerPayout> {
	constructor(@InjectRepository(SellerPayout) readonly repository: Repository<SellerPayout>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}