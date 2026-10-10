import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductPrice } from '../product-price.entity';

@Injectable()
export class TypeOrmProductPriceRepository extends Repository<ProductPrice> {
	constructor(@InjectRepository(ProductPrice) readonly repository: Repository<ProductPrice>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
