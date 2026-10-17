import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seller } from '../seller.entity';

/**
 * The TypeORM side of the Seller aggregate.
 *
 * The repository is a provider rather than a bare injection token so that the service can depend on
 * a named class, which is what lets the same service run against either ORM the installation
 * selected.
 */
@Injectable()
export class TypeOrmSellerRepository extends Repository<Seller> {
	constructor(@InjectRepository(Seller) readonly repository: Repository<Seller>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}