import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductRelation } from '../product-relation.entity';

/**
 * TypeORM repository for `ProductRelation`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmProductRelationRepository extends Repository<ProductRelation> {
	constructor(@InjectRepository(ProductRelation) readonly repository: Repository<ProductRelation>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

