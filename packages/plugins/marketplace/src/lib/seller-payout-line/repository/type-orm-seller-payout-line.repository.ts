import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerPayoutLine } from '../seller-payout-line.entity';

/**
 * The TypeORM side of the SellerPayoutLine aggregate.
 *
 * The repository is a provider rather than a bare injection token so that the service can depend on
 * a named class, which is what lets the same service run against either ORM the installation
 * selected.
 */
@Injectable()
export class TypeOrmSellerPayoutLineRepository extends Repository<SellerPayoutLine> {
	constructor(@InjectRepository(SellerPayoutLine) readonly repository: Repository<SellerPayoutLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}