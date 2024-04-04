import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant } from '../product-variant.entity';

@Injectable()
export class TypeOrmProductVariantRepository extends Repository<ProductVariant> {
    constructor(@InjectRepository(ProductVariant) readonly repository: Repository<ProductVariant>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
