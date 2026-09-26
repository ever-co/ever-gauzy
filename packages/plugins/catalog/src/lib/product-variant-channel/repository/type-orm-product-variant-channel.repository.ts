import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantChannel } from '../product-variant-channel.entity';

/**
 * TypeORM repository for `ProductVariantChannel`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmProductVariantChannelRepository extends Repository<ProductVariantChannel> {
	constructor(@InjectRepository(ProductVariantChannel) readonly repository: Repository<ProductVariantChannel>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

