import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionProduct } from '../collection-product.entity';

/**
 * TypeORM repository for `CollectionProduct`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmCollectionProductRepository extends Repository<CollectionProduct> {
	constructor(@InjectRepository(CollectionProduct) readonly repository: Repository<CollectionProduct>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

