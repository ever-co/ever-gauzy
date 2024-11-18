import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategoryTranslation } from '../product-category-translation.entity';

@Injectable()
export class TypeOrmProductCategoryTranslationRepository extends Repository<ProductCategoryTranslation> {
    constructor(@InjectRepository(ProductCategoryTranslation) readonly repository: Repository<ProductCategoryTranslation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
