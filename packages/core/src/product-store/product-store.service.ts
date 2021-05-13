import { CrudService, IPagination, ProductStore } from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';


export class ProductStoreService extends CrudService<ProductStore> {

    constructor(@InjectRepository(ProductStore)
    private readonly productStoreRepository: Repository<ProductStore>) {
        super(productStoreRepository);
    }

    async findAllProductTypes(	relations?: string[],
		findInput?: any,
		options = {page: 1, limit: 10}): Promise<IPagination<ProductStore>> {

        const total = await this.productStoreRepository.count(findInput);

        const allProductStores = await this.productStoreRepository.find({
            where: findInput,
            relations,
            skip: (options.page - 1) * options.limit,
            take: options.limit
        });

        return {
            items: allProductStores,
            total
        }
   
    }
}