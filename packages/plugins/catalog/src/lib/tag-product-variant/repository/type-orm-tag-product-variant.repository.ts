import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagProductVariant } from '../tag-product-variant.entity';

/**
 * TypeORM repository for `TagProductVariant`.
 *
 * It exists as an injectable so the service can depend on a concrete repository of the plugin rather
 * than on the ORM's generic one, which is what lets the same service be constructed under either ORM.
 */
@Injectable()
export class TypeOrmTagProductVariantRepository extends Repository<TagProductVariant> {
	constructor(@InjectRepository(TagProductVariant) readonly repository: Repository<TagProductVariant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}

