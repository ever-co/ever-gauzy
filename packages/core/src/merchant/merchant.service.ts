import { CrudService, IPagination, Merchant, Warehouse, ImageAsset, Contact } from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';


export class MerchantService extends CrudService<Merchant> {

    constructor(@InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
        @InjectRepository(Warehouse)
        private readonly warehouseRepository: Repository<Warehouse>,
        @InjectRepository(ImageAsset)
        private readonly imageAssetRepository: Repository<ImageAsset>) {
        super(merchantRepository);
    }

    async findMerchantById(id: string, relations: string[]): Promise<Merchant> {
        return await this.merchantRepository.findOne(id, { relations });
    }

    async findAllMechants(relations?: string[],
        findInput?: any,
        options = { page: 1, limit: 10 }): Promise<IPagination<Merchant>> {

        const total = await this.merchantRepository.count(findInput);

        const allMerchants = await this.merchantRepository.find({
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

    async createMerchant(merchantInput: any): Promise<Merchant> {

        const contact = Object.assign(new Contact(), merchantInput.contact);
        const merchant = Object.assign(new Merchant(), { ...merchantInput, contact });

        return await this.merchantRepository.save(merchant);
    }

    async updateMerchant(merchantInput: any): Promise<Merchant> {
        return await this.merchantRepository.save(merchantInput);
    }
}