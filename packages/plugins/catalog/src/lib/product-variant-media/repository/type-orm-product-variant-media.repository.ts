import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantMedia } from '../product-variant-media.entity';

/**
 * TypeORM repository for `ProductVariantMedia`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmProductVariantMediaRepository extends Repository<ProductVariantMedia> {
	constructor(@InjectRepository(ProductVariantMedia) readonly repository: Repository<ProductVariantMedia>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

