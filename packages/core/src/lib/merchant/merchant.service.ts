import { Injectable } from '@nestjs/common';
import { IMerchant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Merchant } from './merchant.entity';
import { MikroOrmMerchantRepository } from './repository/mikro-orm-merchant.repository';
import { TypeOrmMerchantRepository } from './repository/type-orm-merchant.repository';

/**
 * The store, over the platform's tenant-aware CRUD service.
 *
 * **`@Injectable()` is not decoration here — it is what makes the constructor's parameters exist.**
 * Nest injects a provider by reading the `design:paramtypes` metadata TypeScript emits beside a
 * decorated class; a class that carries no decorator gets no such metadata, so the container calls its
 * constructor with nothing and the inherited store is `undefined`. The symptom is not a boot error but
 * a read that fails inside the base service — `Cannot read properties of undefined (reading 'metadata')`
 * — on both protocols at once, because both reach the one service. `tools/scripts/service-injectable-check.mjs`
 * fails the build for any class that extends a CRUD base without it.
 */
@Injectable()
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
		return await this.save({ id, ...merchant });
	}
}
