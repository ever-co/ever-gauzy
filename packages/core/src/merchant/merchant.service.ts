import { CrudService, IPagination, Merchant, Warehouse, ImageAsset, Contact } from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';


export class MerchantService extends CrudService<Merchant> {

    constructor(@InjectRepository(Merchant)
    private readonly productStoreRepository: Repository<Merchant>,
        @InjectRepository(Warehouse)
        private readonly warehouseRepository: Repository<Warehouse>,
        @InjectRepository(ImageAsset)
        private readonly imageAssetRepository: Repository<ImageAsset>) {
        super(productStoreRepository);
    }

    async findAllProductTypes(relations?: string[],
        findInput?: any,
        options = { page: 1, limit: 10 }): Promise<IPagination<Merchant>> {

        const total = await this.productStoreRepository.count(findInput);

        const allMerchants = await this.productStoreRepository.find({
            where: findInput,
            relations,
            skip: (options.page - 1) * options.limit,
            take: options.limit
        });

        return {
            items: allMerchants,
            total
        }

    }

    async createStore(productStoreInput: any) {

        const contact = Object.assign(new Contact(), productStoreInput.contact);
        const productStore = Object.assign(new Merchant(), { ...productStoreInput, contact });

        return await this.productStoreRepository.save(productStore);


    }
}