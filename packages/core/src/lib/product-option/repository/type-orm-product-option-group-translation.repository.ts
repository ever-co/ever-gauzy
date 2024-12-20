import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOptionGroupTranslation } from '../product-option-group-translation.entity';

@Injectable()
export class TypeOrmProductOptionGroupTranslationRepository extends Repository<ProductOptionGroupTranslation> {
    constructor(@InjectRepository(ProductOptionGroupTranslation) readonly repository: Repository<ProductOptionGroupTranslation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
