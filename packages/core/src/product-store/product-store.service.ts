import { CrudService, ProductStore } from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';


export class ProductStoreService extends CrudService<ProductStore> {

    constructor(@InjectRepository(ProductStore)
    private readonly productStoreRepository: Repository<ProductStore>) {
        super(productStoreRepository);
    }
}