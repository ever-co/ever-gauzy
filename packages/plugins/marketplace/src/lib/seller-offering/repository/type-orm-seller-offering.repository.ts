import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerOffering } from '../seller-offering.entity';

/**
 * The TypeORM side of the SellerOffering aggregate.
 *
 * The repository is a provider rather than a bare injection token so that the service can depend on
 * a named class, which is what lets the same service run against either ORM the installation
 * selected.
 */
@Injectable()
export class TypeOrmSellerOfferingRepository extends Repository<SellerOffering> {
	constructor(@InjectRepository(SellerOffering) readonly repository: Repository<SellerOffering>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}