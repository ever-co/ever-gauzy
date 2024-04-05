import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../product.entity';

@Injectable()
export class TypeOrmProductRepository extends Repository<Product> {
    constructor(@InjectRepository(Product) readonly repository: Repository<Product>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
