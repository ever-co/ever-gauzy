import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IMerchant, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Merchant } from './../core/entities/internal';

export class MerchantService extends TenantAwareCrudService<Merchant> {

    constructor(
        @InjectRepository(Merchant)
        private readonly merchantRepository: Repository<Merchant>
    ) {
        super(merchantRepository);
    }

    async findMerchantById(id: string, relations: string[]): Promise<Merchant> {
        return await this.merchantRepository.findOne(id, { relations });
    }

    async findAllMerchants(
		relations?: string[],
		findInput?: any
	): Promise<IPagination<Merchant>> {
		return await this.findAll({
			where: {
				...findInput
			},
			relations
		});
	}

    async update(id: string, merchant: Merchant): Promise<IMerchant> {
		return await this.merchantRepository.save({ id, ...merchant });
	}
}