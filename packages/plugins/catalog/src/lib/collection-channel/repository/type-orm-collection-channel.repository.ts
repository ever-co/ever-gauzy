import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionChannel } from '../collection-channel.entity';

/**
 * TypeORM repository for `CollectionChannel`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmCollectionChannelRepository extends Repository<CollectionChannel> {
	constructor(@InjectRepository(CollectionChannel) readonly repository: Repository<CollectionChannel>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

