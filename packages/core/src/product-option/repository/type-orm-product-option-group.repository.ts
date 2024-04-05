import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOptionGroup } from '../product-option-group.entity';

@Injectable()
export class TypeOrmProductOptionGroupRepository extends Repository<ProductOptionGroup> {
    constructor(@InjectRepository(ProductOptionGroup) readonly repository: Repository<ProductOptionGroup>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
