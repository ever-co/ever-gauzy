import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductTypeTranslation } from '../product-type-translation.entity';

@Injectable()
export class TypeOrmProductTypeTranslationRepository extends Repository<ProductTypeTranslation> {
    constructor(@InjectRepository(ProductTypeTranslation) readonly repository: Repository<ProductTypeTranslation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
