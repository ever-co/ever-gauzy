import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductChannel } from '../product-channel.entity';

/**
 * TypeORM repository for `ProductChannel`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmProductChannelRepository extends Repository<ProductChannel> {
	constructor(@InjectRepository(ProductChannel) readonly repository: Repository<ProductChannel>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

