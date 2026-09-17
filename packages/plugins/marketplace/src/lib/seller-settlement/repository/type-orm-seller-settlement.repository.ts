import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerSettlement } from '../seller-settlement.entity';

/**
 * The TypeORM side of the SellerSettlement aggregate.
 *
 * The repository is a provider rather than a bare injection token so that the service can depend on
 * a named class, which is what lets the same service run against either ORM the installation
 * selected.
 */
@Injectable()
export class TypeOrmSellerSettlementRepository extends Repository<SellerSettlement> {
	constructor(@InjectRepository(SellerSettlement) readonly repository: Repository<SellerSettlement>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}