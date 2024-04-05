import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantPrice } from '../product-variant-price.entity';

@Injectable()
export class TypeOrmProductVariantPriceRepository extends Repository<ProductVariantPrice> {
    constructor(@InjectRepository(ProductVariantPrice) readonly repository: Repository<ProductVariantPrice>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
