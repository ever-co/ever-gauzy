import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseProduct } from '../warehouse-product.entity';

@Injectable()
export class TypeOrmWarehouseProductRepository extends Repository<WarehouseProduct> {
	constructor(@InjectRepository(WarehouseProduct) readonly repository: Repository<WarehouseProduct>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
