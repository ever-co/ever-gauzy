import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IMerchant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Merchant } from './merchant.entity';

export class MerchantService extends TenantAwareCrudService<Merchant> {

    constructor(
        @InjectRepository(Merchant)
        private readonly merchantRepository: Repository<Merchant>
    ) {
        super(merchantRepository);
    }

    async findById(
		id: IMerchant['id'],
		relations: string[] = []
	): Promise<IMerchant> {
        return await this.findOneByIdString(id, { relations });
    }

    async update(
		id: IMerchant['id'],
		merchant: Merchant
	): Promise<IMerchant> {
		return await this.merchantRepository.save({ id, ...merchant });
	}
}