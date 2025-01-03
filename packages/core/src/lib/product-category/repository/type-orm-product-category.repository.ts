import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from '../product-category.entity';

@Injectable()
export class TypeOrmProductCategoryRepository extends Repository<ProductCategory> {
    constructor(@InjectRepository(ProductCategory) readonly repository: Repository<ProductCategory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
