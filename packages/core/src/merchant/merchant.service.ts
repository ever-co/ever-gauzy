import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IMerchant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Merchant } from './merchant.entity';

export class MerchantService extends TenantAwareCrudService<Merchant> {
	constructor(
		@InjectRepository(Merchant)
		merchantRepository: Repository<Merchant>,
		@MikroInjectRepository(Merchant)
		mikroMerchantRepository: EntityRepository<Merchant>
	) {
		super(merchantRepository, mikroMerchantRepository);
	}

	async findById(id: IMerchant['id'], relations: string[] = []): Promise<IMerchant> {
		return await this.findOneByIdString(id, { relations });
	}

	async update(id: IMerchant['id'], merchant: Merchant): Promise<IMerchant> {
		return await this.repository.save({ id, ...merchant });
	}
}
