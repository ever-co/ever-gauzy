import { Repository } from 'typeorm';
import { WarehouseProductVariant } from '../warehouse-product-variant.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmWarehouseProductVariantRepository extends Repository<WarehouseProductVariant> {
	constructor(@InjectRepository(WarehouseProductVariant) readonly repository: Repository<WarehouseProductVariant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
