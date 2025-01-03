import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOption } from '../product-option.entity';

@Injectable()
export class TypeOrmProductOptionRepository extends Repository<ProductOption> {
    constructor(@InjectRepository(ProductOption) readonly repository: Repository<ProductOption>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
