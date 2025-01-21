import { IMerchant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Merchant } from './merchant.entity';
import { MikroOrmMerchantRepository } from './repository/mikro-orm-merchant.repository';
import { TypeOrmMerchantRepository } from './repository/type-orm-merchant.repository';

export class MerchantService extends TenantAwareCrudService<Merchant> {
	constructor(
		typeOrmMerchantRepository: TypeOrmMerchantRepository,
		mikroOrmMerchantRepository: MikroOrmMerchantRepository
	) {
		super(typeOrmMerchantRepository, mikroOrmMerchantRepository);
	}

	async findById(id: IMerchant['id'], relations: string[] = []): Promise<IMerchant> {
		return await this.findOneByIdString(id, { relations });
	}

	async update(id: IMerchant['id'], merchant: Merchant): Promise<IMerchant> {
		return await this.typeOrmRepository.save({ id, ...merchant });
	}
}
