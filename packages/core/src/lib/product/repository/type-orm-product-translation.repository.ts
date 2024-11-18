import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductTranslation } from '../product-translation.entity';

@Injectable()
export class TypeOrmProductTranslationRepository extends Repository<ProductTranslation> {
    constructor(@InjectRepository(ProductTranslation) readonly repository: Repository<ProductTranslation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
