import { CrudService, IPagination, ProductStore, Warehouse, ImageAsset, Contact } from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';


export class ProductStoreService extends CrudService<ProductStore> {

    constructor(@InjectRepository(ProductStore)
    private readonly productStoreRepository: Repository<ProductStore>,
        @InjectRepository(Warehouse)
        private readonly warehouseRepository: Repository<Warehouse>,
        @InjectRepository(ImageAsset)
        private readonly imageAssetRepository: Repository<ImageAsset>) {
        super(productStoreRepository);
    }

    async findAllProductTypes(relations?: string[],
        findInput?: any,
        options = { page: 1, limit: 10 }): Promise<IPagination<ProductStore>> {

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

    async createStore(productStoreInput: any) {

        // const warehouses = await this.warehouseRepository.find({
        //     where: {
        //         id: {
        //             $in: [productStoreInput.warehouseIds]
        //         }
        //     }
        // });

        // const imageAsset = await this.imageAssetRepository.findOne(productStoreInput.imageAssetId);

        //tstodo
        console.log(productStoreInput, 'product store input')

        const contact = Object.assign(new Contact(), productStoreInput.contact);
        const productStore = Object.assign(new ProductStore(), { ...productStoreInput, contact });

        return await this.productStoreRepository.save(productStore);


    }
}