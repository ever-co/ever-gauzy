import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOptionTranslation } from '../product-option-translation.entity';

@Injectable()
export class TypeOrmProductOptionTranslationRepository extends Repository<ProductOptionTranslation> {
    constructor(@InjectRepository(ProductOptionTranslation) readonly repository: Repository<ProductOptionTranslation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
