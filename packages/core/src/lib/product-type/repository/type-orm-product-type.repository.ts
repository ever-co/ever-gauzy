import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductType } from '../product-type.entity';

@Injectable()
export class TypeOrmProductTypeRepository extends Repository<ProductType> {
    constructor(@InjectRepository(ProductType) readonly repository: Repository<ProductType>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
