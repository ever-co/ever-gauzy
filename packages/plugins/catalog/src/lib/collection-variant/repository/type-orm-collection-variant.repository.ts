import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionVariant } from '../collection-variant.entity';

/**
 * TypeORM repository for `CollectionVariant`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmCollectionVariantRepository extends Repository<CollectionVariant> {
	constructor(@InjectRepository(CollectionVariant) readonly repository: Repository<CollectionVariant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

