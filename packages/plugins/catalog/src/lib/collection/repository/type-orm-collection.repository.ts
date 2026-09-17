import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from '../collection.entity';

/**
 * TypeORM repository for `Collection`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmCollectionRepository extends Repository<Collection> {
	constructor(@InjectRepository(Collection) readonly repository: Repository<Collection>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

